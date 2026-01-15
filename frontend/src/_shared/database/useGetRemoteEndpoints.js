import { useQuery } from "@tanstack/react-query"
import { getEndpoints } from "../../services/api";

export const useGetRemoteEndpoints = ({connectionId}) => {
const result = useQuery({
  queryKey: ['endpoints', connectionId],
  queryFn: () => getEndpoints(connectionId),
  placeholderData: prev => prev, 
  enabled: !!connectionId,
})
return result;
}