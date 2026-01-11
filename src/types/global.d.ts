import { User } from '../models/user';

declare global {
	namespace Express {
		interface Request {
			userId?: string;
			user?: User;
			// Add other custom properties as needed
		}
	}
}


