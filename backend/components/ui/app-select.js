"use client"

import Select from "react-select"

function buildStyles({ minHeight = 48 } = {}) {
  return {
    control: (base, state) => ({
      ...base,
      minHeight,
      borderRadius: 16,
      borderColor: state.isFocused ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(2,6,23,0.55)",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(14,165,233,0.12)" : "none",
      cursor: "pointer",
      "&:hover": {
        borderColor: "rgba(255,255,255,0.16)",
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: "0 12px",
    }),
    input: (base) => ({
      ...base,
      color: "#fff",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#fff",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#64748b",
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? "#e2e8f0" : "#64748b",
      "&:hover": {
        color: "#e2e8f0",
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 60,
      overflow: "hidden",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.08)",
      backgroundColor: "#0b1120",
      boxShadow: "0 18px 40px rgba(2,6,23,0.46)",
    }),
    menuList: (base) => ({
      ...base,
      padding: 8,
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: 12,
      backgroundColor: state.isSelected
        ? "rgba(14,165,233,0.18)"
        : state.isFocused
          ? "rgba(255,255,255,0.06)"
          : "transparent",
      color: state.isSelected ? "#e0f2fe" : "#e2e8f0",
      cursor: "pointer",
      "&:active": {
        backgroundColor: "rgba(14,165,233,0.22)",
      },
    }),
  }
}

export function AppSelect({
  options = [],
  value = "",
  onChangeValue,
  placeholder = "Selecione",
  isClearable = false,
  menuPlacement = "auto",
  minHeight = 48,
}) {
  const selectedOption = options.find((option) => option.value === value) ?? null

  return (
    <Select
      unstyled={false}
      instanceId={`app-select-${placeholder}`}
      options={options}
      value={selectedOption}
      onChange={(option) => onChangeValue?.(option?.value ?? "")}
      placeholder={placeholder}
      isClearable={isClearable}
      menuPlacement={menuPlacement}
      styles={buildStyles({ minHeight })}
      noOptionsMessage={() => "Nenhuma opcao"}
    />
  )
}
