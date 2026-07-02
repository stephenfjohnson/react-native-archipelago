// styles/mapDarkStyle.ts — dark theme for react-native-maps (Google provider)
const mapDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b0b12" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a86a3" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b12" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1926" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#2a2740" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#05050a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#151322" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#10201a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1a1926" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2740" }] },
];
export default mapDarkStyle;
