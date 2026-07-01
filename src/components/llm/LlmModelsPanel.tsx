import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LlmCatalog from "./LlmCatalog";
import LlmEndpointsTable from "./LlmEndpointsTable";
import LlmPlayground from "./LlmPlayground";
import ModelRoutingLog from "./ModelRoutingLog";
import EmbeddingsPanel from "./EmbeddingsPanel";

interface Props {
  isAdmin?: boolean;
  projectId?: string;
}

export default function LlmModelsPanel({ isAdmin, projectId }: Props) {
  return (
    <Tabs defaultValue="catalog" className="w-full">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="catalog">Catalog</TabsTrigger>
        <TabsTrigger value="routing">Routing Log</TabsTrigger>
        <TabsTrigger value="embeddings">Embeddings &amp; RAG</TabsTrigger>
        <TabsTrigger value="custom">Custom Endpoints</TabsTrigger>
        <TabsTrigger value="local">Local LLMs</TabsTrigger>
        {isAdmin && <TabsTrigger value="playground">Playground</TabsTrigger>}
      </TabsList>
      <TabsContent value="catalog" className="mt-4">
        <LlmCatalog />
      </TabsContent>
      <TabsContent value="routing" className="mt-4">
        <ModelRoutingLog projectId={projectId} />
      </TabsContent>
      <TabsContent value="embeddings" className="mt-4">
        <EmbeddingsPanel />
      </TabsContent>
      <TabsContent value="custom" className="mt-4">
        <LlmEndpointsTable isAdmin={isAdmin} filter="remote" />
      </TabsContent>
      <TabsContent value="local" className="mt-4">
        <LlmEndpointsTable isAdmin={isAdmin} filter="local" />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="playground" className="mt-4">
          <LlmPlayground />
        </TabsContent>
      )}
    </Tabs>
  );
}
