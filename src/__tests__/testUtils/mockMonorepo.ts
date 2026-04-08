import { jest } from '@jest/globals';
import { MonorepoInfo } from '../../utils/types';
import * as getMonorepoInfoModule from '../../utils/getMonorepoInfo';

export function mockMonorepoAndLogs(fixture: MonorepoInfo | false) {
  const getMonorepoInfoMock = jest
    .spyOn(getMonorepoInfoModule, 'getMonorepoInfo')
    .mockImplementation(() => {
      if (fixture) return fixture;
      throw new Error('options were not validated properly (should not reach this code)');
    });

  // combine console.log and console.warn output in order
  const logs: string[] = [];
  const getConsoleLogs = () => (logs.length ? logs.join('\n').split('\n') : []);
  const saveLog = (...args: any[]) => logs.push(args.join(' '));
  const consoleLogMock = jest.spyOn(console, 'log').mockImplementation(saveLog);
  const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(saveLog);

  const restore = () => {
    getMonorepoInfoMock.mockRestore();
    consoleLogMock.mockRestore();
    consoleWarnMock.mockRestore();
  };

  return { getConsoleLogs, restore };
}
