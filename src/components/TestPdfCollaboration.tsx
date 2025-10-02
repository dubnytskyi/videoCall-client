import { YjsProvider } from '../contexts/YjsContext';
import PdfFieldCollaborator from './PdfFieldCollaborator';

interface TestPdfCollaborationProps {
  roomId: string;
  submitterUuid: string;
  submitterName: string;
  isNotary: boolean;
}

export default function TestPdfCollaboration({
  roomId,
  submitterUuid,
  submitterName,
  isNotary
}: TestPdfCollaborationProps) {
  const participantInfo = {
    notary: { identity: "Notary", isConnected: true, isReady: true },
    client: { identity: "Client", isConnected: true, isReady: true }
  };

  const submitters = [
    { name: "Notary", uuid: "notary-uuid" },
    { name: "Client", uuid: "client-uuid" }
  ];

  return (
    <div className="h-screen bg-gray-100">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">PDF Field Collaboration Test</h1>
        <div className="bg-white rounded-lg shadow-lg h-full">
          <YjsProvider roomId={roomId} submitterUuid={submitterUuid}>
            <PdfFieldCollaborator
              isNotary={isNotary}
              participantInfo={participantInfo}
              submitterUuid={submitterUuid}
              submitterName={submitterName}
              submitters={submitters}
            />
          </YjsProvider>
        </div>
      </div>
    </div>
  );
}
