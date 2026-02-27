
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../screens/GoogleDriveScreen';
import DropboxScreen from '../../screens/DropboxScreen';
import AccountAddScreen from '../../screens/AccountAddScreen';

export type RootStackParamList = {
    Home: undefined;
    Dropbox: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppStack = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Dropbox"
                component={DropboxScreen}
                options={{ headerShown: true }}
            />
            <Stack.Screen
                name="AccountAdd"
                component={AccountAddScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
};

export default AppStack;
