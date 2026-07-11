import { StyleSheet } from "react-native";

import Theme from "./Theme";

const commonStyles = StyleSheet.create({
  textInput: {
    minWidth: "50%",
    height: 44,
    margin: 12,
    borderWidth: 1,
    borderColor: Theme.glassBorder,
    borderRadius: Theme.radius.sm,
    padding: 12,
    backgroundColor: Theme.glassFill,
    color: Theme.textPrimary,
  },
  inputLabel: {
    fontSize: 20,
    color: Theme.textPrimary,
  },
  touchableHighlightButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    borderColor: Theme.accent,
    backgroundColor: Theme.accentDim,
    ...Theme.glow(Theme.accentGlow),
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  touchableHighlightButtonText: {
    fontSize: 13,
    lineHeight: 21,
    fontWeight: "bold",
    letterSpacing: 0.25,
    color: Theme.textPrimary,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    backgroundColor: Theme.overlay,
  },
  modalView: {
    margin: 20,
    backgroundColor: Theme.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.glassBorder,
    padding: 28,
    alignItems: "center",
    alignContent: "center",
    ...Theme.glow(Theme.accentGlow),
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    color: Theme.textPrimary,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
});
export default commonStyles;
