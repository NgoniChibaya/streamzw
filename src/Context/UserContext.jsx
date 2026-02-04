import { createContext, useState } from "react";

export const AuthContext = createContext(null);


export default function Context({ children }) {
  const [User, setUser] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <AuthContext.Provider value={{ User, setUser, isPlaying, setIsPlaying }}>
      {children}
    </AuthContext.Provider>
  );
}
