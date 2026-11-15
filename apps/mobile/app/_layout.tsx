import { api, session } from '../src/api/instance';
import { createRootLayout } from '../src/app/RootLayout';

export default createRootLayout(session, api);
