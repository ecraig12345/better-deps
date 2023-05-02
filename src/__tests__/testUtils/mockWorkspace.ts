import { jest } from '@jest/globals';
import { WorkspacePackagesInfo } from '../../utils/types';
import * as getWorkspaceInfoModule from '../../utils/getWorkspaceInfo';

export function mockWorkspaceAndLogs(fixture: WorkspacePackagesInfo | false) {
  const getWorkspaceInfoMock = jest
    .spyOn(getWorkspaceInfoModule, 'getWorkspaceInfo')
    .mockImplementation(() => {
      if (fixture) return fixture;
      throw new Error('options were not validated properly (should not reach this code)');
    });

  // combine console.log and console.warn output in order
  const logs: string[] = [];
  const getConsoleLogs = () => logs.join('\n');
  const saveLog = (...args: any[]) => logs.push(args.join(' '));
  const consoleLogMock = jest.spyOn(console, 'log').mockImplementation(saveLog);
  const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(saveLog);

  const restore = () => {
    getWorkspaceInfoMock.mockRestore();
    consoleLogMock.mockRestore();
    consoleWarnMock.mockRestore();
  };

  return { getConsoleLogs, restore };
}
