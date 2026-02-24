import { createContext, useState } from "react";

export const AuthContext = createContext(null);


export default function Context({ children }) {
  const [User, setUser] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  return (
    <AuthContext.Provider value={{ User, setUser, isPlaying, setIsPlaying, authLoading, setAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
