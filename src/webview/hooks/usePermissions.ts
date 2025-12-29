import { useState, useEffect } from 'react';

export interface PermissionState {
	owner: { read: boolean; write: boolean; execute: boolean };
	group: { read: boolean; write: boolean; execute: boolean };
	public: { read: boolean; write: boolean; execute: boolean };
}

/**
 * Custom hook for managing file permissions
 * Handles bidirectional conversion between octal notation and checkbox states
 */
export const usePermissions = (initialOctal: string = '644') => {
	const [octal, setOctal] = useState<string>(initialOctal);
	const [permissions, setPermissions] = useState<PermissionState>(octalToPermissions(initialOctal));

	/**
	 * Converts octal string to permission state
	 */
	function octalToPermissions(octalStr: string): PermissionState {
		// Extract last 3 digits (strip any type prefix like 'd', 'l', '-')
		const digits = octalStr.slice(-3).padStart(3, '0');

		const owner = parseInt(digits[0], 10);
		const group = parseInt(digits[1], 10);
		const pub = parseInt(digits[2], 10);

		return {
			owner: {
				read: (owner & 4) !== 0,
				write: (owner & 2) !== 0,
				execute: (owner & 1) !== 0
			},
			group: {
				read: (group & 4) !== 0,
				write: (group & 2) !== 0,
				execute: (group & 1) !== 0
			},
			public: {
				read: (pub & 4) !== 0,
				write: (pub & 2) !== 0,
				execute: (pub & 1) !== 0
			}
		};
	}

	/**
	 * Converts permission state to octal string
	 */
	function permissionsToOctal(perms: PermissionState): string {
		const ownerVal = (perms.owner.read ? 4 : 0) + (perms.owner.write ? 2 : 0) + (perms.owner.execute ? 1 : 0);
		const groupVal = (perms.group.read ? 4 : 0) + (perms.group.write ? 2 : 0) + (perms.group.execute ? 1 : 0);
		const publicVal = (perms.public.read ? 4 : 0) + (perms.public.write ? 2 : 0) + (perms.public.execute ? 1 : 0);

		return `${ownerVal}${groupVal}${publicVal}`;
	}

	/**
	 * Updates octal from permission changes
	 */
	const updatePermission = (category: 'owner' | 'group' | 'public', permission: 'read' | 'write' | 'execute', value: boolean) => {
		const newPermissions = {
			...permissions,
			[category]: {
				...permissions[category],
				[permission]: value
			}
		};

		setPermissions(newPermissions);
		setOctal(permissionsToOctal(newPermissions));
	};

	/**
	 * Updates permissions from octal change
	 */
	const updateOctal = (newOctal: string) => {
		// Validate octal string (should be 3 digits, each 0-7)
		const cleanOctal = newOctal.replace(/[^0-7]/g, '').slice(-3);

		if (cleanOctal.length <= 3) {
			setOctal(cleanOctal);
			if (cleanOctal.length === 3) {
				setPermissions(octalToPermissions(cleanOctal));
			}
		}
	};

	// Sync permissions when initialOctal changes
	useEffect(() => {
		setOctal(initialOctal);
		setPermissions(octalToPermissions(initialOctal));
	}, [initialOctal]);

	return {
		octal,
		permissions,
		updatePermission,
		updateOctal
	};
};
