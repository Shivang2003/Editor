import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Palette,
  RotateCcw,
  Redo2,
  Send,
  Undo2,
  Paperclip,
  Ticket,
  User,
  Hash,
  AtSign
} from "lucide-react";

// Delta Document class for managing editor state
class DeltaDocument {
  constructor(initialText = "\n") {
    this.ops = [{ insert: initialText }];
    this.selection = { index: 0, length: 0 };
    this.history = [];
    this.historyIndex = -1;
  }

  getDelta() {
    return { ops: this.ops };
  }

  saveToHistory() {
    // Remove any history after current index when making new changes
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push({
      ops: JSON.parse(JSON.stringify(this.ops)),
      selection: { ...this.selection },
    });
    this.historyIndex++;

    // Limit history size
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.ops = JSON.parse(JSON.stringify(state.ops));
      this.selection = { ...state.selection };
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.ops = JSON.parse(JSON.stringify(state.ops));
      this.selection = { ...state.selection };
      return true;
    }
    return false;
  }

  insertMention(index, mentionData, trigger) {
    this.saveToHistory();
    
    // Create mention attributes based on trigger type
    const attributes = {
      mention: true,
      mentionType: trigger === '@' ? 'user' : 'ticket',
      mentionId: mentionData.id,
      mentionDisplay: trigger === '@' ? mentionData.name : mentionData.ticketName,
      mentionValue: trigger === '@' ? mentionData.userName : mentionData.ticketName,
      color: trigger === '@' ? '#1e40af' : '#059669', // Blue for users, green for tickets
      backgroundColor: trigger === '@' ? '#dbeafe' : '#d1fae5'
    };

    const displayText = trigger + (trigger === '@' ? mentionData.userName : mentionData.ticketName);
    const newOp = { insert: displayText, attributes };

    // Find the operation that contains this index
    let currentIndex = 0;
    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      const opLength = op.insert.length;

      if (currentIndex + opLength >= index) {
        const splitPoint = index - currentIndex;

        if (splitPoint === 0) {
          // Insert at the beginning of this op
          this.ops.splice(i, 0, newOp);
        } else if (splitPoint === opLength) {
          // Insert at the end of this op
          this.ops.splice(i + 1, 0, newOp);
        } else {
          // Split the operation
          const beforeText = op.insert.substring(0, splitPoint);
          const afterText = op.insert.substring(splitPoint);

          this.ops.splice(
            i,
            1,
            { insert: beforeText, attributes: op.attributes },
            newOp,
            { insert: afterText, attributes: op.attributes }
          );
        }
        break;
      }
      currentIndex += opLength;
    }

    this.mergeConsecutiveOps();
    return displayText.length;
  }

  insert(index, text, attributes) {
    this.saveToHistory();
    const newOp = attributes ? { insert: text, attributes } : { insert: text };

    // Find the operation that contains this index
    let currentIndex = 0;
    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      const opLength = op.insert.length;

      if (currentIndex + opLength >= index) {
        const splitPoint = index - currentIndex;

        if (splitPoint === 0) {
          // Insert at the beginning of this op
          this.ops.splice(i, 0, newOp);
        } else if (splitPoint === opLength) {
          // Insert at the end of this op
          this.ops.splice(i + 1, 0, newOp);
        } else {
          // Split the operation
          const beforeText = op.insert.substring(0, splitPoint);
          const afterText = op.insert.substring(splitPoint);

          this.ops.splice(
            i,
            1,
            { insert: beforeText, attributes: op.attributes },
            newOp,
            { insert: afterText, attributes: op.attributes }
          );
        }
        break;
      }
      currentIndex += opLength;
    }

    this.mergeConsecutiveOps();
  }

  delete(index, length) {
    this.saveToHistory();
    let currentIndex = 0;
    let remainingLength = length;

    for (let i = 0; i < this.ops.length && remainingLength > 0; i++) {
      const op = this.ops[i];
      const opLength = op.insert.length;

      if (currentIndex + opLength > index) {
        const deleteStart = Math.max(0, index - currentIndex);
        const deleteEnd = Math.min(opLength, deleteStart + remainingLength);
        const deleteLength = deleteEnd - deleteStart;

        if (deleteStart === 0 && deleteLength === opLength) {
          // Delete entire operation
          this.ops.splice(i, 1);
          i--;
        } else {
          // Partial delete
          const beforeText = op.insert.substring(0, deleteStart);
          const afterText = op.insert.substring(deleteEnd);
          op.insert = beforeText + afterText;

          if (op.insert === "") {
            this.ops.splice(i, 1);
            i--;
          }
        }

        remainingLength -= deleteLength;
      }

      if (i >= 0) currentIndex += this.ops[i]?.insert?.length || 0;
    }

    this.mergeConsecutiveOps();
  }

  formatInline(index, length, attributes) {
    this.saveToHistory();
    // Get current formatting at selection to determine if we should toggle
    const currentFormat = this.getFormatAt(index, length);
    const shouldToggle = Object.keys(attributes).some(
      (key) => currentFormat[key] === attributes[key]
    );

    let currentIndex = 0;

    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      const opLength = op.insert.length;

      if (currentIndex + opLength > index && currentIndex < index + length) {
        const formatStart = Math.max(0, index - currentIndex);
        const formatEnd = Math.min(opLength, index + length - currentIndex);

        if (formatStart > 0 || formatEnd < opLength) {
          // Need to split the operation
          const parts = [];

          if (formatStart > 0) {
            parts.push({
              insert: op.insert.substring(0, formatStart),
              attributes: op.attributes,
            });
          }

          const newAttributes = { ...op.attributes };
          Object.keys(attributes).forEach((key) => {
            if (shouldToggle && newAttributes[key] === attributes[key]) {
              // Remove the attribute (toggle off)
              delete newAttributes[key];
            } else {
              // Apply the attribute
              newAttributes[key] = attributes[key];
            }
          });

          parts.push({
            insert: op.insert.substring(formatStart, formatEnd),
            attributes: Object.keys(newAttributes).length
              ? newAttributes
              : undefined,
          });

          if (formatEnd < opLength) {
            parts.push({
              insert: op.insert.substring(formatEnd),
              attributes: op.attributes,
            });
          }

          this.ops.splice(i, 1, ...parts);
          i += parts.length - 1;
        } else {
          // Format entire operation
          const newAttributes = { ...op.attributes };
          Object.keys(attributes).forEach((key) => {
            if (shouldToggle && newAttributes[key] === attributes[key]) {
              delete newAttributes[key];
            } else {
              newAttributes[key] = attributes[key];
            }
          });
          op.attributes = Object.keys(newAttributes).length
            ? newAttributes
            : undefined;
        }
      }

      currentIndex += opLength;
    }

    this.mergeConsecutiveOps();
  }

  formatBlock(index, length, attributes) {
    this.saveToHistory();

    // Find the start and end of the line containing the selection
    const text = this.getText();
    let lineStart = text.lastIndexOf("\n", index - 1) + 1;
    let lineEnd = text.indexOf("\n", index);
    if (lineEnd === -1) lineEnd = text.length;

    // Get the current line content
    const lineText = text.substring(lineStart, lineEnd);

    // Handle list formatting
    if (attributes.list) {
      let newLineText = lineText;

      // Remove existing list markers first
      newLineText = newLineText.replace(/^(• |[0-9]+\. )/, "");

      // Check if we're toggling the same list type
      const currentFormat = this.getFormatAt(lineStart, 1);
      if (currentFormat.list === attributes.list) {
        // Remove list formatting (toggle off)
        this.delete(lineStart, lineEnd - lineStart);
        this.insert(lineStart, newLineText);
      } else {
        // Apply list formatting
        if (attributes.list === "bullet") {
          newLineText = "• " + newLineText;
        } else if (attributes.list === "ordered") {
          // Get the next number by looking at the current document state
          const number = this.getNextOrderedNumber(lineStart);
          newLineText = number + ". " + newLineText;
        }

        // Replace the entire line - but don't apply list attributes to the text itself
        // The list formatting is indicated by the presence of the list marker
        this.delete(lineStart, lineEnd - lineStart);
        this.insert(lineStart, newLineText);
      }
    } else {
      // Apply other block formatting normally
      this.formatInline(lineStart, lineEnd - lineStart, attributes);
    }
  }

  // Fixed helper method to get next ordered list number
  getNextOrderedNumber(currentLineStart) {
    const text = this.getText();
    let number = 1;

    // Split text into lines up to current position
    const textBeforeLine = text.substring(0, currentLineStart);
    const lines = textBeforeLine.split("\n");

    // Look backwards for consecutive ordered list items
    let lastNumber = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const match = line.match(/^(\d+)\.\s/);
      if (match) {
        const num = parseInt(match[1]);
        if (lastNumber === 0) {
          // This is the first numbered item we found working backwards
          lastNumber = num;
        } else if (num === lastNumber - 1) {
          // This is the previous number in sequence
          lastNumber = num;
        } else {
          // Break in sequence, stop here
          break;
        }
      } else if (line.startsWith("•")) {
        // Different list type, continue looking
        continue;
      } else {
        // Non-list line, stop here
        break;
      }
    }

    return lastNumber > 0 ? lastNumber + 1 : 1;
  }

  // Handle special Enter key behavior for lists
  handleEnterKey(index) {
    const text = this.getText();
    let lineStart = text.lastIndexOf("\n", index - 1) + 1;
    let lineEnd = text.indexOf("\n", index);
    if (lineEnd === -1) lineEnd = text.length;

    const currentLine = text.substring(lineStart, index);

    // Check if current line looks like a list item
    const isBulletList = currentLine.startsWith("• ");
    const orderedMatch = currentLine.match(/^(\d+)\.\s/);
    const isOrderedList = !!orderedMatch;

    if (isBulletList || isOrderedList) {
      // Check if current line is empty (just the list marker)
      const isEmptyBullet = currentLine.trim() === "•";
      const isEmptyOrdered = /^\d+\.\s*$/.test(currentLine.trim());

      if (isEmptyBullet || isEmptyOrdered) {
        // Exit list mode - remove the empty list item and insert plain newline
        this.delete(lineStart, index - lineStart);
        this.insert(lineStart, "\n");
        this.setSelection({ index: lineStart + 1, length: 0 });
        return true; // Indicate we handled the enter key
      } else {
        // Continue list - insert newline with appropriate list marker
        let listMarker;
        if (isBulletList) {
          listMarker = "• ";
        } else if (isOrderedList) {
          const currentNum = parseInt(orderedMatch[1]);
          listMarker = currentNum + 1 + ". ";
        }

        this.insert(index, "\n" + listMarker);
        this.setSelection({ index: index + 1 + listMarker.length, length: 0 });
        return true;
      }
    }

    return false; // Let normal enter handling proceed
  }

  getFormatAt(index, length) {
    // Get the formatting attributes at the given range
    let currentIndex = 0;
    const formats = [];

    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      const opLength = op.insert.length;

      if (currentIndex + opLength > index && currentIndex < index + length) {
        if (op.attributes) {
          formats.push(op.attributes);
        }

        // Also check if this looks like a list item based on text content
        const text = op.insert;
        const lineStart = Math.max(0, index - currentIndex);
        const lineText = text.substring(lineStart);
        const lineEnd = lineText.indexOf("\n");
        const currentLineText =
          lineEnd >= 0 ? lineText.substring(0, lineEnd) : lineText;

        if (currentLineText.startsWith("• ")) {
          formats.push({ list: "bullet" });
        } else if (/^\d+\.\s/.test(currentLineText)) {
          formats.push({ list: "ordered" });
        }
      }

      currentIndex += opLength;
    }

    // Return the common formatting attributes
    if (formats.length === 0) return {};

    const commonFormat = {};
    const firstFormat = formats[0] || {};

    Object.keys(firstFormat).forEach((key) => {
      if (
        formats.every((format) => format && format[key] === firstFormat[key])
      ) {
        commonFormat[key] = firstFormat[key];
      }
    });

    return commonFormat;
  }

  getText() {
    return this.ops.map((op) => op.insert).join("");
  }

  mergeConsecutiveOps() {
    for (let i = this.ops.length - 1; i > 0; i--) {
      const current = this.ops[i];
      const previous = this.ops[i - 1];

      // Don't merge mentions with other ops
      if (current.attributes?.mention || previous.attributes?.mention) {
        continue;
      }

      if (
        JSON.stringify(current.attributes) ===
        JSON.stringify(previous.attributes)
      ) {
        previous.insert += current.insert;
        this.ops.splice(i, 1);
      }
    }
  }

  setSelection(selection) {
    this.selection = selection;
  }
}

// Mention Dropdown Component
const MentionDropdown = ({ 
  mentions, 
  position, 
  onSelect, 
  onClose, 
  trigger, 
  query 
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);

  const filteredMentions = mentions.filter(mention => {
    const searchText = trigger === '@' ? mention.userName : mention.ticketName;
    return searchText.toLowerCase().includes(query.toLowerCase());
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredMentions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredMentions.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMentions[selectedIndex]) {
          onSelect(filteredMentions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredMentions, selectedIndex, onSelect, onClose]);

  if (filteredMentions.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-64"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {filteredMentions.map((mention, index) => (
        <div
          key={mention.id}
          className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
            index === selectedIndex ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
          }`}
          onClick={() => onSelect(mention)}
        >
          {trigger === '@' ? (
            <>
              <User size={16} className="text-blue-600" />
              <div>
                <div className="font-medium text-sm">{mention.name}</div>
                <div className="text-xs text-gray-500">@{mention.userName}</div>
              </div>
            </>
          ) : (
            <>
              <Hash size={16} className="text-green-600" />
              <div>
                <div className="font-medium text-sm">{mention.ticketName}</div>
                <div className="text-xs text-gray-500">#{mention.id}</div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

// Utility functions for DOM manipulation
const renderDelta = (element, delta) => {
  element.innerHTML = "";

  delta.ops.forEach((op) => {
    if (typeof op.insert === "string") {
      const span = document.createElement("span");
      span.textContent = op.insert;

      // Apply inline formatting
      if (op.attributes) {
        if (op.attributes.bold) span.style.fontWeight = "bold";
        if (op.attributes.italic) span.style.fontStyle = "italic";
        if (op.attributes.underline) span.style.textDecoration = "underline";
        if (op.attributes.color) span.style.color = op.attributes.color;
        if (op.attributes.backgroundColor) {
          span.style.backgroundColor = op.attributes.backgroundColor;
          span.style.padding = "2px 4px";
          span.style.borderRadius = "4px";
        }
        if (op.attributes.mention) {
          span.style.fontWeight = "600";
          span.classList.add("mention");
          span.setAttribute("data-mention-type", op.attributes.mentionType);
          span.setAttribute("data-mention-id", op.attributes.mentionId);
          span.setAttribute("data-mention-display", op.attributes.mentionDisplay);
        }
        if (op.attributes.list) {
          span.style.paddingLeft = "0px";
          span.style.textIndent = "-20px";
        }
      }

      element.appendChild(span);
    }
  });
};

const getTextOffset = (element, node, offset) => {
  let textOffset = 0;
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    if (currentNode === node) {
      return textOffset + offset;
    }
    textOffset += currentNode.textContent.length;
  }

  return textOffset;
};

const setSelectionFromModel = (element, selection) => {
  if (!selection) return;

  const range = document.createRange();
  const sel = window.getSelection();

  let currentOffset = 0;
  let startSet = false;
  let endSet = false;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    const nodeLength = node.textContent.length;

    if (!startSet && currentOffset + nodeLength >= selection.index) {
      range.setStart(node, selection.index - currentOffset);
      startSet = true;
    }

    if (
      !endSet &&
      currentOffset + nodeLength >= selection.index + selection.length
    ) {
      range.setEnd(node, selection.index + selection.length - currentOffset);
      endSet = true;
      break;
    }

    currentOffset += nodeLength;
  }

  if (startSet && !endSet) {
    range.setEnd(range.startContainer, range.startOffset);
  }

  sel.removeAllRanges();
  sel.addRange(range);
};

const rangeToModel = (element, selection) => {
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const startOffset = getTextOffset(
    element,
    range.startContainer,
    range.startOffset
  );
  const endOffset = getTextOffset(element, range.endContainer, range.endOffset);

  return {
    index: Math.min(startOffset, endOffset),
    length: Math.abs(endOffset - startOffset),
  };
};

// Toolbar component
const Toolbar = ({ onCommand, formatState }) => {
  const colors = [
    "#000000",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
  ];

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-gray-300 bg-gray-50">
      <button
        onClick={() => onCommand({ type: "bold" })}
        className={`p-2 rounded border ${
          formatState.bold
            ? "bg-blue-200 border-blue-400"
            : "bg-white border-gray-300"
        } hover:bg-gray-100`}
        title="Bold (Ctrl+B)"
      >
        <Bold size={16} />
      </button>

      <button
        onClick={() => onCommand({ type: "italic" })}
        className={`p-2 rounded border ${
          formatState.italic
            ? "bg-blue-200 border-blue-400"
            : "bg-white border-gray-300"
        } hover:bg-gray-100`}
        title="Italic (Ctrl+I)"
      >
        <Italic size={16} />
      </button>

      <button
        onClick={() => onCommand({ type: "underline" })}
        className={`p-2 rounded border ${
          formatState.underline
            ? "bg-blue-200 border-blue-400"
            : "bg-white border-gray-300"
        } hover:bg-gray-100`}
        title="Underline (Ctrl+U)"
      >
        <Underline size={16} />
      </button>

      <div className="border-l border-gray-400 mx-1"></div>

      <button
        onClick={() => onCommand({ type: "list", value: "bullet" })}
        className={`p-2 rounded border ${
          formatState.list === "bullet"
            ? "bg-blue-200 border-blue-400"
            : "bg-white border-gray-300"
        } hover:bg-gray-100`}
        title="Bullet List"
      >
        <List size={16} />
      </button>

      <button
        onClick={() => onCommand({ type: "list", value: "ordered" })}
        className={`p-2 rounded border ${
          formatState.list === "ordered"
            ? "bg-blue-200 border-blue-400"
            : "bg-white border-gray-300"
        } hover:bg-gray-100`}
        title="Numbered List"
      >
        <ListOrdered size={16} />
      </button>

      <div className="border-l border-gray-400 mx-1"></div>

      <div className="flex items-center gap-1">
        <Palette size={16} />
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onCommand({ type: "color", value: color })}
            className={`w-6 h-6 rounded border ${
              formatState.color === color
                ? "border-blue-400 border-2"
                : "border-gray-300"
            } hover:scale-110 transition-transform`}
            style={{ backgroundColor: color }}
            title={`Color ${color}`}
          />
        ))}
      </div>

      <div className="border-l border-gray-400 mx-2"></div>

      <button
        onClick={() => onCommand({ type: "undo" })}
        className="p-2 rounded border bg-white border-gray-300 hover:bg-gray-100"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>

      <button
        onClick={() => onCommand({ type: "redo" })}
        className="p-2 rounded border bg-white border-gray-300 hover:bg-gray-100"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={16} />
      </button>

      <button
        onClick={() => onCommand({ type: "clear" })}
        className="p-2 px-4 rounded border bg-white border-gray-300 hover:bg-gray-100 text-sm"
        title="Clear formatting"
      >
        Clear Format
      </button>

      <button className="p-2 px-4 rounded border bg-white border-gray-300 hover:bg-gray-100 text-sm">
        <Paperclip size={16} />
      </button>
    </div>
  );
};

// Main Editor component
export default function Editor() {
  const deltaRef = useRef(null);
  const hostRef = useRef(null);
  const [doc] = useState(() => new DeltaDocument("\n"));
  const selRef = useRef(doc.selection);
  const formatRef = useRef({});
  const composingRef = useRef(false);
  const [formatState, setFormatState] = useState({});
  
  // Mention state
  const [mentionState, setMentionState] = useState({
    isActive: false,
    trigger: null,
    query: '',
    startIndex: -1,
    position: { top: 0, left: 0 }
  });

  // Sample required mentions data
  const requiredMentions = {
    "@": [
      { "userName": "chai_with_java", "name": "Chaiwala Dev", "id": "u101" },
      { "userName": "pakoda_programmer", "name": "Fritters Singh", "id": "u102" },
      { "userName": "rickshaw_router", "name": "Auto Query Lal", "id": "u103" },
      { "userName": "dhaba_debugger", "name": "Paneer Tikka Rao", "id": "u104" },
      { "userName": "samosa_stack", "name": "Aloo Compiler", "id": "u105" }
    ],
    "#": [
      { "ticketName": "Code chal raha hai sirf Sharma ji ke WiFi pe", "id": "t201" },
      { "ticketName": "Feature request: chai break ka automatic reminder", "id": "t202" },
      { "ticketName": "Bug: App sirf 4G Jio SIM pe hi open hota hai", "id": "t203" },
      { "ticketName": "Error: Maa ne router band kar diya", "id": "t204" },
      { "ticketName": "Billing bug: Free recharge mil gaya PayTM se", "id": "t205" }
    ]
  };

  const rerender = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;

    renderDelta(el, doc.getDelta());
    setSelectionFromModel(el, doc.selection);

    if (deltaRef.current) {
      deltaRef.current.textContent = JSON.stringify(doc.getDelta(), null, 2);
    }
  }, [doc]);

  const syncSelectionFromDOM = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;
    if (!el.contains(sel.anchorNode)) return;

    const modelSel = rangeToModel(el, sel);
    if (!modelSel) return;

    doc.setSelection(modelSel);
    selRef.current = modelSel;

    // Update format state based on current selection
    updateFormatState(modelSel);

    return modelSel;
  }, [doc]);

  const updateFormatState = (selection) => {
    if (!selection || selection.length === 0) {
      // No selection, use pending format
      setFormatState({ ...formatRef.current });
      return;
    }

    // Get formatting at current selection
    const currentFormat = doc.getFormatAt(selection.index, selection.length);
    setFormatState(currentFormat);
  };

  const checkForMentions = useCallback((text, cursorIndex) => {
    const beforeCursor = text.substring(0, cursorIndex);
    const mentionMatch = beforeCursor.match(/[@#]([a-zA-Z0-9_\s]*)$/);
    
    if (mentionMatch) {
      const trigger = mentionMatch[0][0]; // @ or #
      const query = mentionMatch[1];
      const startIndex = cursorIndex - mentionMatch[0].length;
      
      if (requiredMentions[trigger]) {
        // Get cursor position for dropdown
        const el = hostRef.current;
        const range = document.createRange();
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          const editorRect = el.getBoundingClientRect();
          
          setMentionState({
            isActive: true,
            trigger,
            query,
            startIndex,
            position: {
              top: rect.bottom - editorRect.top + 5,
              left: rect.left - editorRect.left
            }
          });
          return true;
        }
      }
    }
    
    setMentionState(prev => ({ ...prev, isActive: false }));
    return false;
  }, [requiredMentions]);

  const handleMentionSelect = useCallback((mention) => {
    const { trigger, startIndex, query } = mentionState;
    const deleteLength = trigger.length + query.length;
    
    // Delete the trigger and query text
    doc.delete(startIndex, deleteLength);
    
    // Insert the mention
    const insertedLength = doc.insertMention(startIndex, mention, trigger);
    
    // Position cursor after mention
    doc.setSelection({ index: startIndex + insertedLength, length: 0 });
    
    // Close mention dropdown
    setMentionState(prev => ({ ...prev, isActive: false }));
    
    rerender();
  }, [mentionState, doc, rerender]);

  const closeMentionDropdown = useCallback(() => {
    setMentionState(prev => ({ ...prev, isActive: false }));
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const onBeforeInput = (e) => {
      if (e.isComposing || composingRef.current) return;

      syncSelectionFromDOM();
      const sel = doc.selection || { index: 0, length: 0 };
      const attrs = Object.keys(formatRef.current).length
        ? { ...formatRef.current }
        : undefined;

      switch (e.inputType) {
        case "insertText":
          if (sel.length) doc.delete(sel.index, sel.length);
          
          doc.insert(sel.index, e.data, attrs);
          doc.setSelection({ index: sel.index + e.data.length, length: 0 });
          
          // Check for mentions after inserting text
          setTimeout(() => {
            const text = doc.getText();
            checkForMentions(text, sel.index + e.data.length);
          }, 0);
          
          e.preventDefault();
          break;
          
        case "insertParagraph":
          e.preventDefault();
          if (sel.length) doc.delete(sel.index, sel.length);

          // Check if we need special list handling
          if (doc.handleEnterKey(sel.index)) {
            // List handling was done, just rerender
          } else {
            // Normal paragraph insertion
            doc.insert(sel.index, "\n");
            doc.setSelection({ index: sel.index + 1, length: 0 });
          }
          
          // Close mention dropdown on enter
          setMentionState(prev => ({ ...prev, isActive: false }));
          break;
          
        case "deleteContentBackward":
          if (sel.length) doc.delete(sel.index, sel.length);
          else if (sel.index > 0) {
            // Special handling for list items
            const text = doc.getText();
            const lineStart = text.lastIndexOf("\n", sel.index - 1) + 1;
            const currentLine = text.substring(lineStart, sel.index);

            // Check if we're at the beginning of a list item (right after marker)
            if (
              (currentLine === "• " || /^\d+\. $/.test(currentLine)) &&
              sel.index === lineStart + currentLine.length
            ) {
              // Remove list formatting and convert to regular text
              doc.delete(lineStart, currentLine.length);
              doc.setSelection({ index: lineStart, length: 0 });
            } else {
              doc.delete(sel.index - 1, 1);
              doc.setSelection({
                index: Math.max(sel.index - 1, 0),
                length: 0,
              });
            }
          }
          
          // Check for mentions after deletion
          setTimeout(() => {
            const text = doc.getText();
            const newIndex = Math.max(sel.index - 1, 0);
            checkForMentions(text, newIndex);
          }, 0);
          
          e.preventDefault();
          break;
          
        case "deleteContentForward":
          if (sel.length) doc.delete(sel.index, sel.length);
          else doc.delete(sel.index, 1);
          doc.setSelection({ index: sel.index, length: 0 });
          e.preventDefault();
          break;
      }

      rerender();
    };

    const onKeyDown = (e) => {
      // Don't handle keyboard shortcuts if mention dropdown is active
      if (mentionState.isActive) {
        return; // Let MentionDropdown handle the keys
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            handleCommand({ type: "bold" });
            break;
          case "i":
            e.preventDefault();
            handleCommand({ type: "italic" });
            break;
          case "u":
            e.preventDefault();
            handleCommand({ type: "underline" });
            break;
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              handleCommand({ type: "redo" });
            } else {
              handleCommand({ type: "undo" });
            }
            break;
          case "y":
            e.preventDefault();
            handleCommand({ type: "redo" });
            break;
        }
      }
    };

    const onPaste = (e) => {
      e.preventDefault();
      syncSelectionFromDOM();
      const sel = doc.selection || { index: 0, length: 0 };
      const pasteText = e.clipboardData.getData("text/plain") || "";
      if (sel.length) doc.delete(sel.index, sel.length);
      const attrs = Object.keys(formatRef.current).length
        ? { ...formatRef.current }
        : undefined;
      doc.insert(sel.index, pasteText, attrs);
      doc.setSelection({ index: sel.index + pasteText.length, length: 0 });
      rerender();
    };

    const onCompositionStart = () => (composingRef.current = true);
    const onCompositionEnd = () => {
      composingRef.current = false;
      syncSelectionFromDOM();
      rerender();
    };

    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("paste", onPaste);
    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("selectionchange", syncSelectionFromDOM);

    rerender();

    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("selectionchange", syncSelectionFromDOM);
    };
  }, [doc, rerender, syncSelectionFromDOM, checkForMentions, mentionState.isActive]);

  const handleCommand = useCallback(
    (cmd) => {
      syncSelectionFromDOM(); // Make sure we have current selection
      const sel = doc.selection || { index: 0, length: 0 };

      switch (cmd.type) {
        case "bold":
        case "italic":
        case "underline":
          if (sel.length) {
            // Apply/toggle formatting on selection
            doc.formatInline(sel.index, sel.length, { [cmd.type]: true });
            // Update format state based on what was applied
            setTimeout(() => updateFormatState(sel), 0);
          } else {
            // Toggle pending format for next input
            formatRef.current[cmd.type] = !formatRef.current[cmd.type];
            setFormatState((prev) => ({
              ...prev,
              [cmd.type]: formatRef.current[cmd.type],
            }));
          }
          break;
        case "color":
          if (sel.length) {
            doc.formatInline(sel.index, sel.length, { color: cmd.value });
            setTimeout(() => updateFormatState(sel), 0);
          } else {
            formatRef.current.color = cmd.value;
            setFormatState((prev) => ({ ...prev, color: cmd.value }));
          }
          break;
        case "list":
          // Apply list formatting to the current line
          doc.formatBlock(sel.index, Math.max(sel.length, 1), {
            list: cmd.value,
          });
          setTimeout(() => updateFormatState(sel), 0);
          break;
        case "undo":
          if (doc.undo()) {
            rerender();
            setTimeout(() => updateFormatState(doc.selection), 0);
          }
          return;
        case "redo":
          if (doc.redo()) {
            rerender();
            setTimeout(() => updateFormatState(doc.selection), 0);
          }
          return;
        case "clear":
          if (sel.length) {
            // Clear formatting on selection
            const currentFormat = doc.getFormatAt(sel.index, sel.length);
            Object.keys(currentFormat).forEach((key) => {
              doc.formatInline(sel.index, sel.length, { [key]: undefined });
            });
          }
          formatRef.current = {};
          setFormatState({});
          break;
      }

      rerender();
    },
    [doc, rerender, updateFormatState, syncSelectionFromDOM]
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm relative">
        <Toolbar onCommand={handleCommand} formatState={formatState} />

        <div className="relative">
          <div
            ref={hostRef}
            contentEditable
            role="textbox"
            spellCheck={false}
            className="outline-none p-4 min-h-[300px] text-base leading-relaxed bg-white text-black"
            style={{
              whiteSpace: "pre-wrap",
            }}
          />
          
          {mentionState.isActive && (
            <MentionDropdown
              mentions={requiredMentions[mentionState.trigger]}
              position={mentionState.position}
              onSelect={handleMentionSelect}
              onClose={closeMentionDropdown}
              trigger={mentionState.trigger}
              query={mentionState.query}
            />
          )}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-2">Delta Output:</h4>
        <pre
          ref={deltaRef}
          className="bg-gray-100 text-gray-800 p-4 rounded-lg text-sm max-h-[200px] overflow-auto font-mono border"
        />
        <div className="flex gap-3 mt-2">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors duration-200"
            onClick={() => {
              const delta = doc.getDelta();
              console.log("Delta Output:", JSON.stringify(delta, null, 2));
              
              // Extract mentions for API
              const mentions = [];
              delta.ops.forEach(op => {
                if (op.attributes?.mention) {
                  mentions.push({
                    type: op.attributes.mentionType,
                    id: op.attributes.mentionId,
                    display: op.attributes.mentionDisplay,
                    value: op.attributes.mentionValue
                  });
                }
              });
              
              console.log("Extracted Mentions:", mentions);
            }}
          >
            <Send size={16} className="inline mr-2" />
            Send Delta
          </button>
          
          <button
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors duration-200"
            onClick={() => {
              // Reset mention state
              setMentionState({
                isActive: false,
                trigger: null,
                query: '',
                startIndex: -1,
                position: { top: 0, left: 0 }
              });
              console.log("Mention state reset");
            }}
          >
            Reset Mentions
          </button>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h5 className="font-semibold text-blue-800 mb-2">How to use mentions:</h5>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Type <code className="bg-blue-100 px-1 rounded">@</code> followed by a username to mention users</li>
          <li>• Type <code className="bg-blue-100 px-1 rounded">#</code> followed by text to mention tickets</li>
          <li>• Use arrow keys to navigate suggestions</li>
          <li>• Press Enter to select or Escape to cancel</li>
        </ul>
      </div>
    </div>
  );
}
