"use client"

import Select from "react-select"

function buildStyles({ minHeight = 48, tone = "dark", accentColor = "#0ea5e9" } = {}) {
  const light = tone === "light"
  return {
    control: (base, state) => ({
      ...base,
      minHeight,
      borderRadius: 16,
      borderColor: state.isFocused
        ? light ? `${accentColor}55` : "rgba(56,189,248,0.35)"
        : light ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.1)",
      backgroundColor: light ? "#ffffff" : "rgba(2,6,23,0.55)",
      boxShadow: state.isFocused
        ? light ? `0 0 0 2px ${accentColor}1f` : "0 0 0 2px rgba(14,165,233,0.12)"
        : "none",
      cursor: "pointer",
      "&:hover": {
        borderColor: light ? `${accentColor}44` : "rgba(255,255,255,0.16)",
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: "0 12px",
    }),
    input: (base) => ({
      ...base,
      color: light ? "#0f172a" : "#fff",
    }),
    singleValue: (base) => ({
      ...base,
      color: light ? "#0f172a" : "#fff",
    }),
    placeholder: (base) => ({
      ...base,
      color: light ? "#94a3b8" : "#64748b",
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused
        ? light ? accentColor : "#e2e8f0"
        : light ? "#64748b" : "#64748b",
      "&:hover": {
        color: light ? accentColor : "#e2e8f0",
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 60,
      overflow: "hidden",
      borderRadius: 16,
      border: light ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.08)",
      backgroundColor: light ? "#ffffff" : "#0b1120",
      boxShadow: light ? "0 18px 40px rgba(15,23,42,0.12)" : "0 18px 40px rgba(2,6,23,0.46)",
    }),
    menuList: (base) => ({
      ...base,
      padding: 8,
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: 12,
      backgroundColor: state.isSelected
        ? light ? `${accentColor}18` : "rgba(14,165,233,0.18)"
        : state.isFocused
          ? light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)"
          : "transparent",
      color: state.isSelected ? (light ? accentColor : "#e0f2fe") : light ? "#0f172a" : "#e2e8f0",
      cursor: "pointer",
      "&:active": {
        backgroundColor: light ? `${accentColor}20` : "rgba(14,165,233,0.22)",
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
  tone = "dark",
  accentColor = "#0ea5e9",
  isSearchable = false,
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
      isSearchable={isSearchable}
      menuPlacement={menuPlacement}
      styles={buildStyles({ minHeight, tone, accentColor })}
      noOptionsMessage={() => "Nenhuma opcao"}
    />
  )
}
