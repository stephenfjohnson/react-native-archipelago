import { AntDesign, Ionicons } from "@expo/vector-icons";
import React, { ReactNode, useContext, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import APLicense from "../components/APLicense";
import Button from "../components/Button";
import Popup from "../components/Popup";
import AmbientDots from "../components/glass/AmbientDots";
import GlassSurface from "../components/glass/GlassSurface";
import { Settings, SettingsContext } from "../components/SettingsContext";
import commonStyles from "../styles/CommonStyles";
import Theme from "../styles/Theme";
import { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";

function SectionHeader({ children }: Readonly<{ children: string }>) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Group({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <GlassSurface radius={Theme.radius.md} style={styles.group}>
      {children}
    </GlassSurface>
  );
}

/**
 * Renders the control for a single setting. Input type is determined from the
 * type of the setting's value.
 */
function SettingItem({
  setting,
  onChange,
}: Readonly<{
  setting: Settings;
  onChange: (newValue: any, name: any) => void;
}>) {
  const [settingState, setSettingState] = useState(setting.value);

  if (setting.options) {
    return (
      <View style={styles.segment}>
        {setting.options.map((opt) => {
          const selected = settingState === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setSettingState(opt.value);
                onChange(opt.value, setting.name);
              }}
              style={[styles.segmentItem, selected && styles.segmentItemActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (typeof setting.value === "string") {
    return (
      <TextInput
        style={styles.valueInput}
        defaultValue={setting.value}
        placeholderTextColor={Theme.textTertiary}
        onChangeText={(newText) => onChange(newText, setting.name)}
      />
    );
  }
  if (typeof setting.value === "number") {
    return (
      <TextInput
        style={styles.valueInput}
        value={settingState?.toString() ?? ""}
        inputMode="numeric"
        textAlign="center"
        onChangeText={(newText) => {
          setSettingState(newText);
          const newValue = parseInt(newText, 10);
          const min = setting.minValue ?? 0;
          const max = setting.maxValue ?? Infinity;
          if (isNaN(newValue)) {
            //don't change the setting if it is not a number
          } else if (newValue < min) {
            onChange(min, setting.name);
          } else if (newValue > max) {
            onChange(max, setting.name);
          } else {
            onChange(newValue, setting.name);
          }
        }}
        onEndEditing={(e) => {
          const min = setting.minValue ?? 0;
          const max = setting.maxValue ?? Infinity;
          const newValue = parseInt(e.nativeEvent.text, 10);
          if (e.nativeEvent.text === "" || isNaN(newValue))
            setSettingState(setting.value);
          else if (newValue < min) {
            setSettingState(min);
          } else if (newValue > max) {
            setSettingState(max);
          }
        }}
      />
    );
  }
  if (typeof setting.value === "boolean" && typeof settingState === "boolean") {
    return (
      <Switch
        trackColor={{ false: "rgba(255,255,255,0.14)", true: Theme.accent }}
        thumbColor="#ffffff"
        ios_backgroundColor="rgba(255,255,255,0.14)"
        onValueChange={(value) => {
          setSettingState(value);
          onChange(value, setting.name);
        }}
        value={settingState}
      />
    );
  }
}

/**
 * An array containing settings that have unique display
 */
const hiddenSettings = [
  "HOME_LOCATION",
  "USE_HOME_LOCATION",
  "MIN_RADIAN",
  "MAX_RADIAN",
];
export default function SettingsScreen({
  navigation,
}: Readonly<{
  navigation: MaterialTopTabBarProps["navigation"];
}>) {
  const { settings, handleSettingChange } = useContext(SettingsContext);
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDescription, setSelectedDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const closePopup = () => {
    setModalVisible(false);
  };

  const handleBannedLocations = async () => {
    const fgPermission = await Location.getForegroundPermissionsAsync();
    console.log(fgPermission);
    if (fgPermission.granted) {
      const location = await Location.getCurrentPositionAsync();
      navigation.navigate("bannedLocations", { location });
    } else {
      const foregroundStatus =
        await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus.status !== "granted") {
        navigation.navigate("bannedLocations", {
          coords: { latitude: 0, longitude: 0 },
        });
      } else {
        const location = await Location.getCurrentPositionAsync();
        navigation.navigate("bannedLocations", { location });
      }
    }
  };

  const visibleSettings = settings.filter(
    (setting) => !hiddenSettings.includes(setting.name),
  );

  return (
    <View style={styles.screen}>
      <AmbientDots />
      <Popup visible={modalVisible} closePopup={closePopup}>
        <Text style={commonStyles.modalText}>{selectedDescription}</Text>
        <View style={commonStyles.modalButtonContainer}>
          <Button onPress={closePopup} text="Close" />
        </View>
      </Popup>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        <SectionHeader>Location</SectionHeader>
        <Group>
          <Pressable
            style={styles.row}
            disabled={loading}
            onPress={async () => {
              try {
                setLoading(true);
                await handleBannedLocations();
                setLoading(false);
              } catch (e) {
                console.log("failed to navigate to banned locations:", e);
                setLoading(false);
              }
            }}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={Theme.accentBright}
              style={styles.rowIcon}
            />
            <Text style={styles.rowLabel}>Manage banned locations</Text>
            {loading ? (
              <ActivityIndicator size="small" color={Theme.textSecondary} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Theme.textTertiary}
              />
            )}
          </Pressable>
        </Group>

        <SectionHeader>Preferences</SectionHeader>
        <Group>
          {visibleSettings.map((setting, i) => (
            <View
              key={setting.name}
              style={[styles.row, i > 0 && styles.divider]}
            >
              <Text style={styles.rowLabel}>{setting.displayName}</Text>
              <AntDesign
                onPress={() => {
                  setSelectedDescription(setting.description);
                  setModalVisible(true);
                }}
                name="question-circle"
                size={15}
                color={Theme.textTertiary}
                style={styles.help}
              />
              <SettingItem setting={setting} onChange={handleSettingChange} />
            </View>
          ))}
        </Group>

        <SectionHeader>About</SectionHeader>
        <APLicense />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  scroll: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: Theme.textPrimary,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Theme.textTertiary,
    marginLeft: 28,
    marginTop: 22,
    marginBottom: 8,
  },
  group: {
    marginHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.glassBorder,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: Theme.textPrimary,
    paddingRight: 10,
  },
  help: {
    marginRight: 12,
  },
  valueInput: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.glassBorder,
    backgroundColor: Theme.glassFill,
    color: Theme.textPrimary,
    fontSize: 16,
  },
  segment: {
    flexDirection: "row",
    borderRadius: Theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.glassBorder,
    backgroundColor: Theme.glassFill,
    overflow: "hidden",
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentItemActive: {
    backgroundColor: Theme.accent,
  },
  segmentText: {
    fontSize: 14,
    color: Theme.textSecondary,
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
