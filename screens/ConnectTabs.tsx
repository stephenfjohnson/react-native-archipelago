import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";

import Connect from "./Connect";
import SavedInfo from "./SavedInfo";
import Settings from "./Settings";
import GlassTabBar from "../components/glass/GlassTabBar";
import { glassTabScreenOptions } from "../components/glass/GlassTabBarBackground";

const Tab = createBottomTabNavigator();

export default function ConnectTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Connect"
      screenOptions={glassTabScreenOptions}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Connect">
        {(props) => <Connect {...props} />}
      </Tab.Screen>
      <Tab.Screen name="Saved Connections" component={SavedInfo} />
      <Tab.Screen name="Settings">
        {(props) => <Settings {...props} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
