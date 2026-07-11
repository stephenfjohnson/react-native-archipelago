import { StyleSheet } from "react-native";

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
    backgroundColor: "white",
    padding: 8,
    borderRadius: 1,
    elevation: 10,
    opacity: 0.75,
    borderBlockColor: "lightgray",
  },
  apButton: {
    position: "absolute",
    top: 12,
    right: 60,
    zIndex: 1000,
    backgroundColor: "white",
    padding: 8,
    paddingTop: 7,
    borderRadius: 1,
    elevation: 10,
    opacity: 0.75,
    borderBlockColor: "lightgray",
  },
  osmAttribution: {
    position: "absolute",
    bottom: 2,
    left: 6,
    zIndex: 1000,
    fontSize: 10,
    color: "black",
    backgroundColor: "#ffffffb0",
    paddingHorizontal: 4,
    borderRadius: 2,
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
