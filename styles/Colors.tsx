// styles/Colors.tsx
// Semantic GAME colors (players/items/locations). UI surface/text tokens live in Theme.tsx.
const Colors = {
  black: "#F5F3FF", // was "#000000"; used as default text color — now light for dark UI
  red: "#FF5C77",
  green: "#2FE6A0", // typically a location
  playerOther: "#E0B341", // typically other slots/players
  blue: "#7FB0FF", // typically extra info (such as entrance)
  playerSelf: "#EE55EE", // typically your slot/player
  filler: "#22C7C7", // typically regular item
  useful: "#8AA6FF", // typically useful item
  progression: "#B99CFF", // typically progression item
  trap: "#FF7A6B", // typically trap item
  white: "#FFFFFF",
  progUseful: "#F0D33A",
  progTrap: "#FFAC1C",
  usefulTrap: "#B06BD6",
  progUsefulTrap: "#80FF80",
};
export default Colors;
