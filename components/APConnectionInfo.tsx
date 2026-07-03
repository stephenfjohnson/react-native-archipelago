import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Button from "./Button";
import GlassSurface from "./glass/GlassSurface";
import Theme from "../styles/Theme";

export type apInfo = {
  hostname: string;
  port: number;
  name: string;
  password?: string;
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Row({
  icon,
  first,
  children,
}: Readonly<{ icon: IconName; first?: boolean; children: ReactNode }>) {
  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      <Ionicons
        name={icon}
        size={19}
        color={Theme.textSecondary}
        style={styles.rowIcon}
      />
      {children}
    </View>
  );
}

/**
 * Renders AP information inputs
 * @param onPress a method that is run when the included button is pressed
 * @param buttonText What the button says on it
 * @param loading State that when it is true, the fields and button are disabled
 * @param savedInfo default values for the fields
 */
export default function APConnectionInfo({
  onPress,
  buttonText,
  loading,
  savedInfo,
}: Readonly<{
  onPress: (apInfo: apInfo) => void;
  buttonText: string;
  loading: boolean;
  savedInfo?: apInfo;
}>) {
  const [apInfo, setApInfo] = useState<apInfo>(
    savedInfo || {
      hostname: "archipelago.gg",
      port: 0,
      name: "",
      password: undefined,
    },
  );
  const [portString, setPortString] = useState(
    savedInfo?.port.toString() ?? "",
  );
  return (
    <View style={styles.container}>
      <GlassSurface radius={Theme.radius.lg} style={styles.card}>
        <Row icon="globe-outline" first>
          <TextInput
            style={styles.input}
            placeholderTextColor={Theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => setApInfo({ ...apInfo, hostname: text })}
            value={apInfo.hostname}
            editable={!loading}
            placeholder="Address"
          />
        </Row>
        <Row icon="git-network-outline">
          <TextInput
            style={styles.input}
            placeholderTextColor={Theme.textTertiary}
            keyboardType="number-pad"
            onChangeText={(text) => {
              setPortString(text);
              setApInfo({ ...apInfo, port: parseInt(text, 10) || 0 });
            }}
            value={portString}
            editable={!loading}
            placeholder="Port"
          />
        </Row>
        <Row icon="person-outline">
          <TextInput
            style={styles.input}
            placeholderTextColor={Theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => setApInfo({ ...apInfo, name: text })}
            value={apInfo.name}
            editable={!loading}
            placeholder="Slot name"
          />
        </Row>
        <Row icon="lock-closed-outline">
          <TextInput
            style={styles.input}
            placeholderTextColor={Theme.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) =>
              setApInfo({ ...apInfo, password: text || undefined })
            }
            value={apInfo.password}
            editable={!loading}
            placeholder="Password (optional)"
          />
        </Row>
      </GlassSurface>

      <Button
        text={buttonText}
        textStyle={{ fontSize: 16 }}
        buttonStyle={styles.cta}
        onPress={() => onPress(apInfo)}
        buttonProps={{ disabled: loading }}
        removeText={loading}
      >
        {loading && (
          <ActivityIndicator size="small" color={Theme.textPrimary} />
        )}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  card: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 54,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.glassBorder,
  },
  rowIcon: {
    width: 26,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Theme.textPrimary,
    paddingVertical: 0,
  },
  cta: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: Theme.radius.md,
  },
});
