import { StyleSheet } from "react-native";

import Theme from "./Theme";

const mainStyles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Theme.bg,
    alignItems: "center",
    height: "100%",
  },
  connectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderColor: Theme.glassBorder,
  },
});
export default mainStyles;
