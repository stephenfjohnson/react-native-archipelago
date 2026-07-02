import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";

import Connect from "./Connect";
import SavedInfo from "./SavedInfo";
import Settings from "./Settings";
import {
  glassTabScreenOptions,
} from "../components/glass/GlassTabBarBackground";

const Tab = createBottomTabNavigator();

export default function ConnectTabs() {
  return (
    <Tab.Navigator initialRouteName="Connect" screenOptions={glassTabScreenOptions}>
      <Tab.Screen
        name="Connect"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="link" color={color} size={size} />
          ),
        }}
      >
        {(props) => <Connect {...props} />}
      </Tab.Screen>
      <Tab.Screen
        name="Saved Connections"
        component={SavedInfo}
        options={{
          tabBarLabel: "Saved",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" color={color} size={size} />
          ),
        }}
      >
        {(props) => <Settings {...props} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
