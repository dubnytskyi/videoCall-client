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
  // Always use Vercel server for development and production
  return "https://video-call-azure-two.vercel.app";
}
