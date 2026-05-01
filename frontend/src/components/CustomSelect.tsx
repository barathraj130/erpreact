import React, { useState, useRef, useEffect, ReactNode } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

interface CustomSelectProps {
  value?: string | number | null;
  onChange?: (e: any) => void;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  disableSearch?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  children,
  className,
  style,
  placeholder,
  disabled,
  disableSearch,
  required,
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // parse options from children robustly
  const options: { value: string; label: string }[] = [];
  const extractOptions = (nodes: any) => {
    React.Children.forEach(nodes, (child) => {
      if (!child) return;
      if (React.isValidElement(child)) {
        if (child.type === "option") {
          const props = child.props as any;
          let label = String(props.children || "");
          if (Array.isArray(props.children)) {
            label = props.children.join("");
          }
          options.push({ value: String(props.value || ""), label });
        } else if (child.type === React.Fragment) {
          extractOptions((child.props as any).children);
        }
      } else if (Array.isArray(child)) {
        extractOptions(child);
      }
    });
  };
  extractOptions(children);
  // console.log("Extracted options:", options.length);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div
      ref={ref}
      className={`custom-select-container ${className || ""}`}
      style={{ position: "relative", width: "100%", minWidth: "160px" }}
    >
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#FFFFFF",
          borderRadius: "100px",
          border: isOpen
            ? "1px solid var(--primary)"
            : "1px solid var(--border-subtle)",
          boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          color: selectedOption ? "#1E293B" : "#94A3B8",
          fontWeight: 400,
          fontSize: "0.9rem",
          opacity: disabled ? 0.6 : 1,
          ...style,
        }}
      >
        {isOpen && !disableSearch ? (
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              width: "100%",
              fontWeight: 400,
              fontSize: "0.9rem",
              color: "#1E293B",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span style={{ fontWeight: 400 }}>
            {selectedOption ? selectedOption.label : placeholder || "Select..."}
          </span>
        )}
        <div
          style={{
            color: "var(--primary)",
            marginLeft: "12px",
            display: "flex",
            alignItems: "center",
            opacity: 0.7,
          }}
        >
          {isOpen ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#FFFFFF",
            borderRadius: "16px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
            zIndex: 9999,
            maxHeight: "260px",
            overflowY: "auto",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            border: "1px solid rgba(0,0,0,0.05)",
          }}
          className="custom-select-dropdown"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className="custom-select-option"
                onClick={() => {
                  if (onChange) {
                    onChange({ target: { value: opt.value } });
                  }
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 400,
                  transition: "all 0.2s",
                  background:
                    String(value) === String(opt.value)
                      ? "#F1F5F9"
                      : "transparent",
                  color:
                    String(value) === String(opt.value)
                      ? "var(--primary)"
                      : "#475569",
                }}
                onMouseEnter={(e) => {
                  if (String(value) !== String(opt.value)) {
                    e.currentTarget.style.background = "#F8FAFC";
                  }
                }}
                onMouseLeave={(e) => {
                  if (String(value) !== String(opt.value)) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px 16px",
                color: "#94A3B8",
                fontSize: "0.9rem",
                textAlign: "center",
                fontWeight: 500,
              }}
            >
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
