export interface GuestProfile {
  guestId: string;
  email: string;
  firstName: string;
  lastName: string;
  propertyId: string;
}
export interface GuestTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}
