import { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { ConnectionOptions, itemsHandlingFlags } from "archipelago.js";
import React, { useContext, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "react-native-get-random-values";

import { EXTRA_DATA } from "./SavedInfo";
import APConnectionInfo, { apInfo } from "../components/APConnectionInfo";
import Button from "../components/Button";
import { APInfo, ClientContext } from "../components/ClientContext";
import { ErrorContext } from "../components/ErrorContext";
import Popup from "../components/Popup";
import AmbientDots from "../components/glass/AmbientDots";
import BrandMark from "../components/glass/BrandMark";
import commonStyles from "../styles/CommonStyles";
import Theme from "../styles/Theme";
import {
  STORAGE_TYPES,
  getAllNames,
  remove,
  save,
} from "../utils/storageHandler";

export default function Connect({
  navigation,
}: Readonly<{
  navigation: MaterialTopTabBarProps["navigation"];
}>) {
  const { client, connectionInfoRef } = useContext(ClientContext);
  const { setError } = useContext(ErrorContext);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [infoToSave, setInfoToSave] = useState<APInfo | object>({});

  const connect = () => {
    navigation.navigate("connected", {
      sessionName,
    });
    setModalVisible(false);
  };
  const saveInfoAndConnect = async () => {
    EXTRA_DATA.forEach((data) => {
      remove(sessionName + data.name);
    });
    await save(infoToSave, sessionName, STORAGE_TYPES.OBJECT);
    connect();
  };

  const handleSaveConnectionInfo = async () => {
    const existingNames = await getAllNames();
    if (existingNames?.some((value: string) => value === sessionName)) {
      Alert.alert(
        "A connection is already saved with the specified name",
        "Do you want to replace the existing one with this new one?\nNOTE: Deletes all saved info relating to this connection",
        [
          {
            text: "Cancel",
            onPress: () => null,
            style: "cancel",
          },
          {
            text: "Replace",
            onPress: () => {
              saveInfoAndConnect();
            },
          },
        ],
      );
    } else {
      saveInfoAndConnect();
    }
  };

  const connectToAP = async (apInfo: apInfo) => {
    try {
      setLoading(true);
      const game = "Archipela-Go!";
      const port = apInfo.port !== 0 ? apInfo.port : 38281;
      const connectionInfo: ConnectionOptions = {
        items: itemsHandlingFlags.all,
        password: apInfo.password ?? "",
      };
      const url = apInfo.hostname + ":" + port.toString();

      client.options.timeout = 3000;
      await client.login(url.toString(), apInfo.name, game, connectionInfo);
      const connectionOptions = {
        url,
        name: apInfo.name,
        game,
        connectionInfo,
      };
      if (connectionInfoRef !== null) {
        connectionInfoRef.current = connectionOptions;
      }
      setSessionName(`${apInfo.name} @ ${apInfo.hostname}:${port}`);
      setModalVisible(true);
      setInfoToSave({ ...connectionOptions, apInfo });
      setLoading(false);
      setError("");
    } catch (e) {
      setError(e);
      console.error(e);
      setLoading(false);
    }
  };

  const closePopup = () => {
    client.socket.disconnect();
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AmbientDots />
      <View style={styles.content}>
        <View style={styles.header}>
          <BrandMark size={82} />
          <Text style={styles.title}>Archipela-Go</Text>
          <Text style={styles.subtitle}>Connect to a multiworld</Text>
        </View>
        <APConnectionInfo
          onPress={connectToAP}
          buttonText="Connect to Archipelago"
          loading={loading}
        />
      </View>
      <Popup visible={modalVisible} closePopup={closePopup}>
        <Text style={commonStyles.modalText}>
          What do you want to save this connection as?
        </Text>
        <TextInput
          style={commonStyles.textInput}
          onChangeText={(text) => {
            setSessionName(text);
          }}
          value={sessionName}
          editable={!loading}
          placeholder="Session name"
        />
        <View style={commonStyles.modalButtonContainer}>
          <Button
            text="Cancel"
            onPress={() => {
              closePopup();
            }}
          />
          <Button
            text="Save"
            onPress={() => handleSaveConnectionInfo()}
            buttonStyle={{ marginLeft: 20 }}
          />
        </View>
      </Popup>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.bg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    marginTop: 16,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: Theme.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: Theme.textSecondary,
  },
});
