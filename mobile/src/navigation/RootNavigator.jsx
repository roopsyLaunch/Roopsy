import React, { useEffect } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { LoginScreen, RegisterScreen } from "../screens/LoginScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { BarberDetailScreen } from "../screens/BarberDetailScreen";
import { MyBookingsScreen } from "../screens/MyBookingsScreen";
import { FavoritesScreen } from "../screens/FavoritesScreen";
import { ExploreScreen } from "../screens/ExploreScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { BarberDashboardScreen } from "../screens/BarberDashboardScreen";
import { BarberSlotsScreen } from "../screens/BarberSlotsScreen";
import { BarberProfileEditScreen } from "../screens/BarberProfileEditScreen";
import { AdminApprovalsScreen } from "../screens/AdminApprovalsScreen";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminPartnersScreen } from "../screens/admin/AdminPartnersScreen";
import { AdminCustomersScreen } from "../screens/admin/AdminCustomersScreen";
import { AdminOrdersScreen } from "../screens/admin/AdminOrdersScreen";
import { AdminFinanceScreen } from "../screens/admin/AdminFinanceScreen";
import { AdminCatalogScreen } from "../screens/admin/AdminCatalogScreen";
import { AdminAnalyticsScreen } from "../screens/admin/AdminAnalyticsScreen";
import { PendingBarberScreen } from "../screens/PendingBarberScreen";
import { RejectedBarberScreen } from "../screens/RejectedBarberScreen";
import { getSocket } from "../api/socket";
// Barber Screens
import { BarberListScreen } from "../screens/barber/BarberListScreen";

// Tailor Screens
import { TailorListScreen } from "../screens/tailor/TailorListScreen";
import { BeautyParlorListScreen } from "../screens/beauty/BeautyParlorListScreen";
import { BeautyParlorDetailScreen } from "../screens/beauty/BeautyParlorDetailScreen";
import { TailorDetailScreen } from "../screens/tailor/TailorDetailScreen";
import { TailorOrderScreen } from "../screens/tailor/TailorOrderScreen";
import { TailorServiceModeScreen } from "../screens/tailor/TailorServiceModeScreen";
import { TailorFabricScreen } from "../screens/tailor/TailorFabricScreen";
import { TailorDesignScreen } from "../screens/tailor/TailorDesignScreen";
import { TailorMeasurementSelectScreen } from "../screens/tailor/TailorMeasurementSelectScreen";
import { MeasurementListScreen } from "../screens/tailor/MeasurementListScreen";
import { MeasurementFormScreen } from "../screens/tailor/MeasurementFormScreen";
import { TailorDashboardScreen } from "../screens/tailor/TailorDashboardScreen";
import { TailorOrdersScreen } from "../screens/tailor/TailorOrdersScreen";
import { TailorServicesScreen } from "../screens/tailor/TailorServicesScreen";
import { ProductionBoardScreen }      from "../screens/tailor/ProductionBoardScreen";
import { PartnerOrderDetailScreen }   from "../screens/tailor/PartnerOrderDetailScreen";
import { TailorCRMScreen }            from "../screens/tailor/TailorCRMScreen";
import { TailorCRMDetailScreen }      from "../screens/tailor/TailorCRMDetailScreen";
import { TailorInventoryScreen }      from "../screens/tailor/TailorInventoryScreen";
import { TailorStaffScreen }          from "../screens/tailor/TailorStaffScreen";
import { TailorFinanceScreen }        from "../screens/tailor/TailorFinanceScreen";
import { ComingSoonScreen }           from "../screens/ComingSoonScreen";
import { UserGuideScreen }            from "../screens/UserGuideScreen";

// Partner Wizard Screens
import { PartnerEntryScreen } from "../screens/partner/PartnerEntryScreen";
import { PartnerCategoryScreen } from "../screens/partner/PartnerCategoryScreen";
import { PartnerBasicInfoScreen } from "../screens/partner/PartnerBasicInfoScreen";
import { PartnerServicesScreen } from "../screens/partner/PartnerServicesScreen";
import { PartnerHoursScreen } from "../screens/partner/PartnerHoursScreen";
import { PartnerGalleryScreen } from "../screens/partner/PartnerGalleryScreen";
import { PartnerReviewScreen } from "../screens/partner/PartnerReviewScreen";
import { PartnerSubmittedScreen } from "../screens/partner/PartnerSubmittedScreen";

const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const ExploreStack = createNativeStackNavigator();
const BarberStack = createNativeStackNavigator();
const TailorStack = createNativeStackNavigator();
const PartnerStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function BarberStackNavigator() {
  return (
    <BarberStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f8fafc" },
        headerShadowVisible: false,
      }}
    >
      <BarberStack.Screen 
        name="BarberHome" 
        component={BarberDashboardScreen} 
        options={{ title: "Shop Dashboard", headerShown: true }} 
      />
      <BarberStack.Screen 
        name="BarberProfileEdit" 
        component={BarberProfileEditScreen} 
        options={{ headerShown: false }} 
      />
    </BarberStack.Navigator>
  );
}

function TailorStackNavigator() {
  return (
    <TailorStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f8fafc" },
        headerShadowVisible: false,
      }}
    >
      <TailorStack.Screen name="TailorHome"          component={TailorDashboardScreen}     options={{ title: "Partner Dashboard", headerShown: false }} />
      <TailorStack.Screen name="TailorOrders"         component={TailorOrdersScreen}         options={{ title: "All Orders" }} />
      <TailorStack.Screen name="TailorServices"       component={TailorServicesScreen}       options={{ title: "Services & Pricing" }} />
      <TailorStack.Screen name="ProductionBoard"      component={ProductionBoardScreen}      options={{ title: "Production Board", headerShown: false }} />
      <TailorStack.Screen name="PartnerOrderDetail"   component={PartnerOrderDetailScreen}   options={{ title: "Order Detail",       headerShown: false }} />
      <TailorStack.Screen name="TailorCRM"            component={TailorCRMScreen}            options={{ title: "Customer CRM",       headerShown: false }} />
      <TailorStack.Screen name="TailorCRMDetail"      component={TailorCRMDetailScreen}      options={{ title: "Customer Profile",   headerShown: false }} />
      <TailorStack.Screen name="TailorInventory"      component={TailorInventoryScreen}      options={{ title: "Inventory",           headerShown: false }} />
      <TailorStack.Screen name="TailorStaff"          component={TailorStaffScreen}          options={{ title: "Staff ERP",           headerShown: false }} />
      <TailorStack.Screen name="TailorFinance"        component={TailorFinanceScreen}        options={{ title: "Finance & Growth",    headerShown: false }} />
      <TailorStack.Screen name="TailorShopEdit"       component={BarberProfileEditScreen}    options={{ title: "Shop Profile",        headerShown: false }} />
    </TailorStack.Navigator>
  );
}

function PartnerRegistrationNavigator() {
  return (
    <PartnerStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#ffffff" } }}>
      <PartnerStack.Screen name="PartnerEntry" component={PartnerEntryScreen} />
      <PartnerStack.Screen name="PartnerCategory" component={PartnerCategoryScreen} />
      <PartnerStack.Screen name="PartnerBasicInfo" component={PartnerBasicInfoScreen} />
      <PartnerStack.Screen name="PartnerServices" component={PartnerServicesScreen} />
      <PartnerStack.Screen name="PartnerHours" component={PartnerHoursScreen} />
      <PartnerStack.Screen name="PartnerGallery" component={PartnerGalleryScreen} />
      <PartnerStack.Screen name="PartnerReview" component={PartnerReviewScreen} />
      <PartnerStack.Screen name="PartnerSubmitted" component={PartnerSubmittedScreen} />
    </PartnerStack.Navigator>
  );
}

function AdminStackNavigator() {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f8fafc" } }}>
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <AdminStack.Screen name="AdminPartners" component={AdminPartnersScreen} />
      <AdminStack.Screen name="AdminCustomers" component={AdminCustomersScreen} />
      <AdminStack.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <AdminStack.Screen name="AdminFinance" component={AdminFinanceScreen} />
      <AdminStack.Screen name="AdminCatalog" component={AdminCatalogScreen} />
      <AdminStack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
      <AdminStack.Screen name="BarberDetail" component={BarberDetailScreen} />
      <AdminStack.Screen name="BeautyParlorDetail" component={BeautyParlorDetailScreen} />
      <AdminStack.Screen name="TailorList" component={TailorListScreen} />
      <AdminStack.Screen name="TailorDetail" component={TailorDetailScreen} />
    </AdminStack.Navigator>
  );
}

function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f8fafc" },
        headerShadowVisible: false,
      }}
    >
      <ExploreStack.Screen name="ExploreMain" component={ExploreScreen} options={{ headerShown: false }} />
      <ExploreStack.Screen
        name="BarberDetail"
        component={BarberDetailScreen}
        options={({ route }) => ({
          title: route.params?.shopName || "Details",
          headerTitleStyle: { fontWeight: "700", color: "#0f172a" },
        })}
      />
      <ExploreStack.Screen
        name="BeautyParlorDetail"
        component={BeautyParlorDetailScreen}
        options={({ route }) => ({
          title: route.params?.shopName || "Details",
          headerTitleStyle: { fontWeight: "700", color: "#0f172a" },
        })}
      />
    </ExploreStack.Navigator>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f8fafc" },
        headerShadowVisible: false,
      }}
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="BarberList" component={BarberListScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="TailorList" component={TailorListScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="BeautyParlorList" component={BeautyParlorListScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="BeautyParlorDetail" component={BeautyParlorDetailScreen} options={{ headerShown: false }} />
      <HomeStack.Screen 
        name="TailorDetail" 
        component={TailorDetailScreen} 
        options={({ route }) => ({
          title: route.params?.shopName || "Details",
          headerTitleStyle: { fontWeight: "700", color: "#0f172a" },
        })} 
      />
      <HomeStack.Screen name="TailorServiceMode" component={TailorServiceModeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="TailorWorkspace" component={TailorStackNavigator} options={{ headerShown: false }} />
      <HomeStack.Screen name="AdminWorkspace" component={AdminStackNavigator} options={{ headerShown: false }} />
      <HomeStack.Screen name="TailorFabric" component={TailorFabricScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="TailorDesign" component={TailorDesignScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="TailorMeasurementSelect" component={TailorMeasurementSelectScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="TailorOrder" component={TailorOrderScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="MeasurementList" component={MeasurementListScreen} options={{ title: "My Measurements", headerShown: true }} />
      <HomeStack.Screen name="MeasurementForm" component={MeasurementFormScreen} options={{ title: "Measurement", headerShown: true }} />
      <HomeStack.Screen name="ComingSoon" component={ComingSoonScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="UserGuide" component={UserGuideScreen} options={{ headerShown: false }} />
    </HomeStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: "#f8fafc" },
        headerShadowVisible: false,
      }}
    >
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="MeasurementList" component={MeasurementListScreen} options={{ title: "My Measurements", headerShown: true }} />
      <ProfileStack.Screen name="MeasurementForm" component={MeasurementFormScreen} options={{ title: "Measurement", headerShown: true }} />
      <ProfileStack.Screen name="UserGuide" component={UserGuideScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="AdminWorkspace" component={AdminStackNavigator} options={{ headerShown: false }} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  const { user, barber, tailor } = useAuth();
  const isAdmin = user?.role === "admin";
  const isApprovedBarber = user?.role === "barber" && barber?.approvalStatus === "approved";
  const isPendingBarber = user?.role === "barber" && barber?.approvalStatus === "pending";
  const isRejectedBarber = user?.role === "barber" && barber?.approvalStatus === "rejected";
  const isTailorPartner = user?.role === "tailor";
  const isPartner = user?.role === "barber" || isTailorPartner || isAdmin;

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (socket) {
      const handleNewBooking = (data) => {
        if (isPartner) {
          Alert.alert("New Booking", "You have received a new booking request.");
        }
      };
      const handleBookingUpdated = (data) => {
        if (data.status === "cancelled" || data.status === "declined") {
           Alert.alert("Booking Cancelled", "A booking was cancelled or declined.");
        } else if (data.status === "confirmed") {
           Alert.alert("Booking Confirmed", "Your booking has been confirmed.");
        }
      };

      socket.on("newBooking", handleNewBooking);
      socket.on("bookingUpdated", handleBookingUpdated);

      return () => {
        socket.off("newBooking", handleNewBooking);
        socket.off("bookingUpdated", handleBookingUpdated);
      };
    }
  }, [user, isPartner]);

  // Pending barber should be able to configure their shop
  // We'll show a warning banner in their Dashboard instead of blocking them completely.

  // Rejected barber — rejection screen dikhao
  if (isRejectedBarber) {
    return <RejectedBarberScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: { 
            backgroundColor: "#ffffff", 
            minHeight: 70, 
            paddingBottom: 10,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "#f1f5f9",
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
          },
          tabBarActiveTintColor: "#6d28d9",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 4 },
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === "Home")         iconName = focused ? "home"        : "home-outline";
            if (route.name === "MyBookings")   iconName = focused ? "calendar"    : "calendar-outline";
            if (route.name === "Favorites")    iconName = focused ? "heart"       : "heart-outline";
            if (route.name === "LiveSlots")    iconName = focused ? (isTailorPartner ? "options" : "time") : (isTailorPartner ? "options-outline" : "time-outline");
            if (route.name === "Approvals")    iconName = focused ? "shield"      : "shield-outline";
            if (route.name === "Profile")      iconName = focused ? "person"      : "person-outline";

            if (route.name === "Partners") {
              return (
                <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
                  <View style={[styles.middleTabIcon, focused && styles.middleTabIconActive]}>
                    <Ionicons name={isPartner ? "storefront" : "add"} size={26} color="#ffffff" style={{ marginLeft: 1 }} />
                  </View>
                </View>
              );
            }

            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}
      >
        {/* ========== ADMIN TABS ========== */}
        {isAdmin ? (
          <>
            <Tab.Screen name="Home" component={HomeStackNavigator} />
            <Tab.Screen name="Approvals" component={AdminApprovalsScreen} options={{ tabBarLabel: "Approvals" }} />
            <Tab.Screen name="Partners" component={BarberStackNavigator} options={{ tabBarLabel: "Manage" }} />
            <Tab.Screen name="LiveSlots" component={BarberSlotsScreen} options={{ tabBarLabel: "Live Slots" }} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
            {/* Hidden screens */}
            <Tab.Screen name="BarberDetail" component={BarberDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="BeautyParlorDetail" component={BeautyParlorDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
          </>
        ) : isTailorPartner ? (
          /* ========== TAILOR PARTNER TABS ========== */
          <>
            <Tab.Screen name="Home" component={HomeStackNavigator} />
            <Tab.Screen name="MyBookings" component={TailorOrdersScreen} options={{ tabBarLabel: "Orders" }} />
            <Tab.Screen name="Partners" component={TailorStackNavigator} options={{ tabBarLabel: "Manage" }} />
            <Tab.Screen name="LiveSlots" component={TailorServicesScreen} options={{ tabBarLabel: "Services" }} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
            {/* Hidden screens */}
            <Tab.Screen name="BarberDetail" component={BarberDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="BeautyParlorDetail" component={BeautyParlorDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
          </>
        ) : isPartner ? (
          /* ========== APPROVED OR PENDING BARBER TABS ========== */
          <>
            <Tab.Screen name="Home" component={HomeStackNavigator} />
            <Tab.Screen name="MyBookings" component={MyBookingsScreen} options={{ tabBarLabel: "Bookings" }} />
            <Tab.Screen name="Partners" component={BarberStackNavigator} options={{ tabBarLabel: "Manage" }} />
            <Tab.Screen name="LiveSlots" component={BarberSlotsScreen} options={{ tabBarLabel: "Live Slots" }} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
            {/* Hidden screens */}
            <Tab.Screen name="BarberDetail" component={BarberDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="BeautyParlorDetail" component={BeautyParlorDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
          </>
        ) : (
          /* ========== CUSTOMER TABS ========== */
          <>
            <Tab.Screen name="Home" component={HomeStackNavigator} />
            <Tab.Screen name="MyBookings" component={MyBookingsScreen} options={{ tabBarLabel: "Bookings" }} />
            <Tab.Screen 
              name="Partners" 
              component={PartnerRegistrationNavigator}
              options={{ tabBarLabel: "Become Partner" }}
            />
            <Tab.Screen name="Favorites" component={FavoritesScreen} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
            {/* Hidden screens */}
            <Tab.Screen name="BarberDetail" component={BarberDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="BeautyParlorDetail" component={BeautyParlorDetailScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
            <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarItemStyle: { display: "none" }, unmountOnBlur: true }} />
          </>
        )}
      </Tab.Navigator>
    </View>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
        contentStyle: { backgroundColor: "#f8fafc" },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  return token ? <MainTabs /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fafafc", padding: 24 },
  middleTabIcon: {
    position: "absolute",
    bottom: 2,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3.5,
    borderColor: "#ffffff",
  },
  middleTabIconActive: {
    backgroundColor: "#6d28d9",
  },
});
