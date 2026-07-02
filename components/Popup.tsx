import React, { ReactNode } from "react";
import { Modal, View, ViewStyle } from "react-native";

import GlassSurface from "./glass/GlassSurface";
import Theme from "../styles/Theme";
import commonStyles from "../styles/CommonStyles";

export default function Popup({
  visible,
  closePopup,
  popupStyle,
  animationType = "slide",
  children,
}: Readonly<{
  visible: boolean;
  closePopup: () => void;
  popupStyle?: ViewStyle;
  animationType?: Modal["props"]["animationType"];
  children?: ReactNode | ReactNode[];
}>) {
  return (
    <Modal
      animationType={animationType}
      transparent
      visible={visible}
      onRequestClose={() => {
        closePopup();
      }}
    >
      <View style={commonStyles.centeredView}>
        <GlassSurface
          radius={Theme.radius.lg}
          style={[{ margin: 20, ...Theme.glow(Theme.accentGlow) }, popupStyle]}
        >
          <View style={{ padding: 28, alignItems: "center" }}>{children}</View>
        </GlassSurface>
      </View>
    </Modal>
  );
}
