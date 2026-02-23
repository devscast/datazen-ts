import { ConflictResolutionMode } from "./for-update/conflict-resolution-mode";

export class ForUpdate {
  constructor(public readonly conflictResolutionMode: ConflictResolutionMode) {}
}
