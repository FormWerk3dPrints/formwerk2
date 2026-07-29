import { useId, type ReactNode, type ChangeEventHandler } from "react";

interface InputProps {
  label?: string;
  id?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  helper?: string;
  error?: string;
  iconLeft?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  as?: "input" | "textarea";
  rows?: number;
  className?: string;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

export default function Input({
  label,
  id,
  type = "text",
  placeholder,
  value,
  defaultValue,
  helper,
  error,
  iconLeft,
  disabled = false,
  fullWidth = true,
  as = "input",
  rows = 3,
  className = "",
  onChange,
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const fieldClasses = [
    "rounded-lg border text-sm text-gray-900 outline-none transition-[border-color,box-shadow] duration-200 ease-out",
    iconLeft ? "pl-10 pr-3.5 py-2.5" : "px-3.5 py-2.5",
    disabled ? "bg-gray-100" : "bg-white",
    error
      ? "border-error-500"
      : "border-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20",
    fullWidth ? "w-full" : "",
    as === "textarea" ? "resize-y" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-gray-800">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {iconLeft && (
          <span className="pointer-events-none absolute left-3 inline-flex text-gray-400">{iconLeft}</span>
        )}
        {as === "textarea" ? (
          <textarea
            id={inputId}
            rows={rows}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            onChange={onChange}
            className={fieldClasses}
          />
        ) : (
          <input
            id={inputId}
            type={type}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            onChange={onChange}
            className={fieldClasses}
          />
        )}
      </div>
      {(helper || error) && (
        <p className={`mt-1.5 text-xs ${error ? "text-error-600" : "text-gray-500"}`}>{error || helper}</p>
      )}
    </div>
  );
}
