import { StyleSheet } from "react-native";

import Theme from "./Theme";

const mapStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  refreshButton: {
    position: "absolute",
    top: 60,
    right: 12,
    zIndex: 1000,
    backgroundColor: Theme.glassFill,
    borderWidth: 1,
    borderColor: Theme.glassBorder,
    padding: 8,
    borderRadius: Theme.radius.md,
    elevation: 10,
    opacity: 0.95,
    borderBlockColor: "lightgray",
  },
  apButton: {
    position: "absolute",
    top: 12,
    right: 60,
    zIndex: 1000,
    backgroundColor: Theme.glassFill,
    borderWidth: 1,
    borderColor: Theme.glassBorder,
    padding: 8,
    paddingTop: 7,
    borderRadius: Theme.radius.md,
    elevation: 10,
    opacity: 0.95,
    borderBlockColor: "lightgray",
  },
  apLogo: {
    maxWidth: 23,
    maxHeight: 23,
    borderRadius: 0,
    resizeMode: "contain",
    margin: 0,
  },
});

export default mapStyles;
