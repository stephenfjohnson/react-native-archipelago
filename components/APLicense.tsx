import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  ImageSourcePropType,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import GlassSurface from "./glass/GlassSurface";
import Theme from "../styles/Theme";

const LicenseItem = ({
  logoLink,
  logo,
  mainTextLink,
  mainText,
  subText,
  first,
}: {
  logoLink?: string;
  logo?: ImageSourcePropType;
  mainTextLink?: string;
  mainText?: string;
  subText?: string;
  first?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.row, !first && styles.divider]}
    activeOpacity={0.6}
    onPress={() =>
      (mainTextLink || logoLink) &&
      Linking.openURL((mainTextLink ?? logoLink) as string)
    }
  >
    <View style={styles.logoSlot}>
      {logo && <Image source={logo} style={styles.image} />}
    </View>
    <View style={styles.textCol}>
      <Text style={styles.name} numberOfLines={2}>
        {mainText}
      </Text>
      {subText ? (
        <Text style={styles.sub} numberOfLines={1}>
          {subText}
        </Text>
      ) : null}
    </View>
    <FontAwesome
      name="chevron-right"
      size={13}
      color={Theme.textTertiary}
      style={styles.chevron}
    />
  </TouchableOpacity>
);

export default function APLicense() {
  return (
    <GlassSurface radius={Theme.radius.md} style={styles.group}>
      <LicenseItem
        first
        mainTextLink="https://www.openstreetmap.org/copyright"
        mainText="Location data by OpenStreetMap"
        subText="Open Database License"
      />
      <LicenseItem
        logoLink="https://github.com/ArchipelagoMW/Archipelago"
        logo={require("../assets/color-icon.png")}
        mainTextLink="http://creativecommons.org/licenses/by-nc/4.0/"
        mainText="Archipelago logo © 2022 Krista Corkos & Christopher Wilson"
        subText="CC Attribution-NonCommercial 4.0"
      />
      <LicenseItem
        mainTextLink="https://github.com/NewSoupVi/ArchipelagoJingles/"
        mainText="Archipelago jingles by NewSoupVi"
        subText="MIT License"
      />
      <LicenseItem
        logo={require("../assets/archipela-go-logo_full.png")}
        mainText="Archipela-Go! logo by @combo89"
        subText="Based on the Archipelago logo"
      />
      <LicenseItem
        logoLink="https://sunny.garden/@linkhs"
        logo={require("../assets/APMarker_blue.png")}
        mainTextLink="https://sunny.garden/@linkhs"
        mainText="Map markers by @linkhs"
        subText="Based on the Archipelago logo"
      />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.glassBorder,
  },
  logoSlot: {
    width: 30,
    height: 30,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },
  textCol: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimary,
  },
  sub: {
    fontSize: 12,
    color: Theme.textTertiary,
    marginTop: 2,
  },
  chevron: {
    marginLeft: 8,
  },
});
