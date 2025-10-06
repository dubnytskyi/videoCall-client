// Configuration for the client application
export const config = {
  // Server URL - will be set based on environment
  serverUrl: getServerUrl(),

  // Video room name
  roomName: "notary-room",

  // Participant identities
  identities: {
    notary: "Notary",
    client: "Client",
  },
};

// Helper function to get server URL
export function getServerUrl(): string {
  // Use Railway server for production
  return "https://videocall-production-3a01.up.railway.app";
}
