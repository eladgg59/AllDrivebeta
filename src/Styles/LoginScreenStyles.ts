import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#7d7dff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    welcomeText: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 40,
    },
    logo: {
        width: 150,
        height: 150,
        marginBottom: 40,
    },
    input: {
        width: '30%',
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 10,
        borderRadius: 5,
    },
    errorText: {
        color: '#ff0000',
        marginBottom: 10,
    },
    button: {
        width: '20%',
        backgroundColor: '#4b4bff',
        padding: 15,
        borderRadius: 5,
        marginTop: 10,
    },
    buttonContent: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
    },
    loader: {
        marginLeft: 10,
    },
    signupContainer: {
        flexDirection: 'row',
        marginTop: 20,
    },
    downText: {
        color: '#fff',
    },
    signup: {
        color: '#4b4bff',
        fontWeight: 'bold',
    },
}); 