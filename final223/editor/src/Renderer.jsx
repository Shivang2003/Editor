import React, { useRef, useEffect } from "react";

const Renderer = ({ delta }) => {
  const containerRef = useRef(null);

 
  const constructHref = (baseUrl, queryParams) => {
    if (!queryParams) return baseUrl;
    const query = new URLSearchParams(queryParams).toString();
    return `${baseUrl}${query}`;
  };

  // Function to render delta
  const renderDelta = (element, delta) => {
    if (!delta || !delta.ops) return;

    element.innerHTML = ""; 

    delta.ops.forEach((op) => {
      if (typeof op.insert === "string") {
        const lines = op.insert.split("\n");

        lines.forEach((line, index) => {
          let el;

          const attr = op.attributes || {};

          // If baseUrl and queryParams exist, use <a>
          if (attr.baseUrl && attr.queryParams) {
            el = document.createElement("a");
            el.href = constructHref(attr.baseUrl, attr.queryParams);
            el.target = "_blank";
          } else {
            el = document.createElement("span");
          }

          el.textContent = line;

          if (attr.bold) el.style.fontWeight = "bold";
          if (attr.italic) el.style.fontStyle = "italic";
          if (attr.underline) el.style.textDecoration = "underline";
          if (attr.color) el.style.color = attr.color;
          if (attr.backgroundColor) {
            el.style.backgroundColor = attr.backgroundColor;
            el.style.padding = "2px 4px";
            el.style.borderRadius = "4px";
          }

          if (attr.mention) {
            el.style.fontWeight = "600";
            el.style.color = attr.mentionTextColor || "black";
            el.style.backgroundColor = attr.mentionBgColor || "#eee";
            el.style.borderRadius = "4px";
            el.style.padding = "2px 4px";
            el.classList.add("mention");

            if (attr.mentionType) el.setAttribute("data-mention-type", attr.mentionType);
            if (attr.id) el.setAttribute("data-mention-id", attr.id);
            if (attr.displayMentionText) el.setAttribute("data-mention-display", attr.displayMentionText);
          }

          element.appendChild(el);

          if (index < lines.length - 1) {
            element.appendChild(document.createElement("br"));
          }
        });
      }
    });
  };

  useEffect(() => {
    if (delta && containerRef.current) {
      renderDelta(containerRef.current, delta);
    }
  }, [delta]);

  return (
    <div className="flex justify-center items-center">
      <div
        ref={containerRef}
        className="outline-none p-4 text-base leading-relaxed bg-white text-black w-[850px]"
      />
    </div>
  );
};

export default Renderer;
