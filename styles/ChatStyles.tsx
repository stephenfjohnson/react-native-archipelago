import { StyleSheet } from "react-native";

import Theme from "./Theme";

const chatStyles = StyleSheet.create({
  chat: {
    flexDirection: "column",
    flex: 1,
    flexWrap: "nowrap",
    rowGap: 10,
    margin: 5,
  },
  message: {
    flex: 1,
    color: Theme.textPrimary,
  },
  chatBox: {
    flex: 1,
  },
  chatInputBox: {
    flexDirection: "row",
    marginBottom: 5,
    marginRight: 5,
  },
});
export default chatStyles;
