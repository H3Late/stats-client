import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

const FONT = "VT323, monospace";

// Light mode palette values — mirrors index.css :root
const light = {
  primary: "hsl(280, 85%, 55%)",
  secondary: "hsl(320, 75%, 60%)",
  background: "hsl(220, 15%, 95%)",
  paper: "hsl(220, 20%, 98%)",
  textPrimary: "hsl(270, 20%, 15%)",
  textSecondary: "hsl(270, 15%, 40%)",
  border: "hsl(270, 10%, 75%)",
  muted: "hsl(270, 12%, 88%)",
  rowHover: "rgba(0,0,0,0.04)",
  headerBg: "rgba(0,0,0,0.05)",
};

// Dark mode palette values — mirrors index.css .dark
const dark = {
  primary: "hsl(280, 85%, 62%)",
  secondary: "hsl(320, 75%, 65%)",
  background: "hsl(220, 25%, 8%)",
  paper: "hsl(220, 22%, 12%)",
  textPrimary: "hsl(280, 15%, 92%)",
  textSecondary: "hsl(270, 10%, 68%)",
  border: "hsl(270, 15%, 22%)",
  muted: "hsl(270, 12%, 25%)",
  rowHover: "rgba(255,255,255,0.04)",
  headerBg: "rgba(255,255,255,0.05)",
};

export function createAppTheme(mode: "light" | "dark") {
  const p = mode === "dark" ? dark : light;

  return createTheme({
    palette: {
      mode,
      primary: { main: p.primary },
      secondary: { main: p.secondary },
      background: { default: p.background, paper: p.paper },
      text: { primary: p.textPrimary, secondary: p.textSecondary },
      divider: p.border,
    },
    typography: {
      fontFamily: FONT,
      fontSize: 14,
    },
    shape: {
      borderRadius: 4,
    },
    components: {
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: "none",
            backgroundColor: "transparent",
            fontFamily: FONT,
            fontSize: "0.875rem",
            "& .MuiDataGrid-scrollbar": {
              scrollbarWidth: "thin",
              scrollbarColor: `${p.border} transparent`,
            },
          },
          columnHeader: {
            backgroundColor: p.headerBg,
            color: p.textSecondary,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            borderBottom: `1px solid ${p.border}`,
            "&:focus, &:focus-within": {
              outline: `2px solid ${p.primary}`,
              outlineOffset: -2,
            },
          },
          columnHeaderTitle: {
            fontWeight: 400,
            fontFamily: FONT,
          },
          columnSeparator: {
            color: p.border,
          },
          cell: {
            borderBottom: `1px solid ${p.border}`,
            color: p.textPrimary,
            "&:focus, &:focus-within": {
              outline: `2px solid ${p.primary}`,
              outlineOffset: -2,
            },
          },
          row: {
            "&:hover": {
              backgroundColor: p.rowHover,
            },
            "&.Mui-selected": {
              backgroundColor: `${p.primary}18`,
              "&:hover": {
                backgroundColor: `${p.primary}28`,
              },
            },
          },
          footerContainer: {
            borderTop: `1px solid ${p.border}`,
            backgroundColor: p.headerBg,
            color: p.textSecondary,
            fontFamily: FONT,
            fontSize: "0.75rem",
          },
          toolbarContainer: {
            padding: "12px 16px",
            gap: "12px",
            borderBottom: `1px solid ${p.border}`,
            flexWrap: "wrap",
          },
          overlay: {
            backgroundColor: `${p.paper}b3`,
            backdropFilter: "blur(1px)",
            color: p.textSecondary,
            fontFamily: FONT,
            fontSize: "0.875rem",
          },
          virtualScroller: {
            backgroundColor: "transparent",
          },
          panel: {
            maxWidth: "100vw",
          },
          panelWrapper: {
            maxWidth: "100%",
            overflow: "hidden",
          },
          panelContent: {
            overflowX: "auto",
          },
          filterForm: {
            flexWrap: "wrap",
            gap: "8px",
            padding: "8px",
          },
          filterFormColumnInput: {
            flex: "1 1 140px",
            minWidth: "120px",
          },
          filterFormOperatorInput: {
            flex: "1 1 120px",
            minWidth: "100px",
          },
          filterFormValueInput: {
            flex: "1 1 140px",
            minWidth: "120px",
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            fontFamily: FONT,
            color: p.textSecondary,
          },
          selectLabel: { fontFamily: FONT },
          displayedRows: { fontFamily: FONT },
          select: { fontFamily: FONT },
        },
      },
    },
  });
}
