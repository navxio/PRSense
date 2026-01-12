import { ContextQuery } from "../model/ContextQuery.js";
import { RetrievedContext } from "../model/RetrievedContext.js";
export interface ContextRetriever {
  retrieve(query: ContextQuery): Promise<RetrievedContext>;
}
