import React from "react";

type AuthContextType = {
  loggedInUser: any;
  setLoggedInUser: React.Dispatch<React.SetStateAction<any>>;
};

const AuthContext = React.createContext<AuthContextType>({
  loggedInUser: null,
  setLoggedInUser: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loggedInUser, setLoggedInUser] = React.useState<any>(null);

  return (
    <AuthContext.Provider value={{ loggedInUser, setLoggedInUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);

export default AuthContext;
