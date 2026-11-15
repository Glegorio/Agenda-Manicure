import { api, session } from '../src/api/instance';
import { createRootLayout } from '../src/navigation/RootLayout';

export default createRootLayout(session, api);
