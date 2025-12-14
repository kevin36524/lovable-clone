export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Session {
  user: User;
  iat: number;
  exp: number;
}

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
}
