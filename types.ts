// types.ts
import { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
    GoogleDrive: undefined;
    Dropbox: undefined;
};

export type NavigationProp = StackNavigationProp<RootStackParamList>;
