import { AbstractException } from "../../abstract-exception";

/**
 * @internal
 */
export class PortWithoutHost extends AbstractException {
  public static new(): PortWithoutHost {
    return new PortWithoutHost("Connection port specified without the host");
  }
}
