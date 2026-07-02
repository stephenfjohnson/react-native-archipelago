import { StyleSheet } from "react-native";

import Theme from "./Theme";

const errorStyles = StyleSheet.create({
  container: {
    backgroundColor: Theme.surface,
    flexDirection: "row",
    padding: 5,
    alignItems: "center",
  },
  text: {
    color: Theme.danger,
    flex: 10,
    verticalAlign: "middle",
    fontSize: 18,
  },
  button: {
    flex: 3,
    paddingVertical: "5%",
  },
  icon: {
    flex: 3,
  },
});

export default errorStyles;
