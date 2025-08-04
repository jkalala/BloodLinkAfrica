/**
 * Detox E2E Testing Configuration
 * 
 * Comprehensive mobile E2E testing setup for iOS and Android
 * with device configurations, test runners, and CI/CD integration
 */

module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupFilesAfterEnv: ['<rootDir>/e2e/init.js']
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/BloodLinkAfrica.app',
      build: 'xcodebuild -workspace ios/BloodLinkAfrica.xcworkspace -scheme BloodLinkAfrica -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/BloodLinkAfrica.app',
      build: 'xcodebuild -workspace ios/BloodLinkAfrica.xcworkspace -scheme BloodLinkAfrica -configuration Release -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081]
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14 Pro'
      }
    },
    'simulator.iphone12': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 12'
      }
    },
    'simulator.iphone15': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro Max'
      }
    },
    'simulator.ipad': {
      type: 'ios.simulator',
      device: {
        type: 'iPad Pro (12.9-inch) (6th generation)'
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_7_API_33'
      }
    },
    'emulator.pixel4': {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_4_API_30'
      }
    },
    'emulator.tablet': {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_Tablet_API_33'
      }
    },
    'device.ios': {
      type: 'ios.device',
      device: {
        id: 'auto'
      }
    },
    'device.android': {
      type: 'android.attached',
      device: {
        adbName: 'auto'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release'
    },
    'ios.device': {
      device: 'device.ios',
      app: 'ios.release'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release'
    },
    'android.device': {
      device: 'device.android',
      app: 'android.release'
    },
    // Multi-device configurations for comprehensive testing
    'ios.multi': {
      device: ['simulator', 'simulator.iphone12', 'simulator.ipad'],
      app: 'ios.debug'
    },
    'android.multi': {
      device: ['emulator', 'emulator.pixel4', 'emulator.tablet'],
      app: 'android.debug'
    }
  },
  behavior: {
    init: {
      reinstallApp: true,
      launchApp: true
    },
    launchApp: 'auto',
    cleanup: {
      shutdownDevice: false
    }
  },
  artifacts: {
    rootDir: './e2e/artifacts',
    pathBuilder: './e2e/utils/pathBuilder.js',
    plugins: {
      log: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false
      },
      screenshot: {
        enabled: true,
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: false,
        takeWhen: {
          testStart: false,
          testDone: true,
          appNotReady: true
        }
      },
      video: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false,
        android: {
          bitRate: 4000000,
          timeLimit: 300000,
          verbose: false
        },
        simulator: {
          codec: 'h264',
          bitRate: 4000000,
          timeLimit: 300000
        }
      },
      instruments: {
        enabled: process.env.CI !== 'true',
        keepOnlyFailedTestsArtifacts: false
      },
      timeline: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false
      },
      uiHierarchy: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false
      }
    }
  },
  session: {
    server: 'ws://localhost:8099',
    sessionId: 'BloodLinkAfrica'
  },
  logger: {
    level: process.env.CI ? 'info' : 'debug',
    overrideConsole: true,
    options: {
      showLoggerName: true,
      showLevel: true,
      showMetadata: false
    }
  }
}
