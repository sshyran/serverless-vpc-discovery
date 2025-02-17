"use strict";

import * as AWS from "aws-sdk";
import * as AWSMock from "aws-sdk-mock";
import chai = require("chai");
import spies = require("chai-spies");
import VPCPlugin from "../../src/index";
import { FuncVPCDiscovery } from "../../src/types";

const expect = chai.expect;
chai.use(spies);

const emptyData = require("./empty-data.json");
const testData = require("./test-data.json");

// Used for changing what to test
const testCreds = {
  accessKeyId: "test_key",
  secretAccessKey: "test_secret",
  sessionToken: "test_session"
};
const vpc = "test";
const subnets = [
  {
    tagKey: "Name",
    tagValues: [
      "test_subnet_1",
      "test_subnet_2",
      "test_subnet_3"
    ]
  }
];
const securityGroups = [
  {
    names: ["test_group_1"]
  }
];
const vpcId = "vpc-test";

// This will create a mock plugin to be used for testing
const testFuncName = "funcTest";
let consoleOutput = [];
const constructPlugin = (vpcConfig) => {
  const serverless = {
    service: {
      provider: {
        region: "us-moon-1"
      },
      functions: {
        [testFuncName]: {}
      },
      custom: {
        vpcDiscovery: vpcConfig
      }
    },
    cli: {
      log (str: string) {
        consoleOutput.push(str);
      }
    },
    providers: {
      aws: {
        getCredentials: () => new AWS.Credentials(testCreds),
        getRegion: () => "us-moon-1"
      }
    },
    configSchemaHandler: {
      defineCustomProperties: (props: any) => {},
      defineFunctionProperties: (provider: string, props: any) => {}
    }
  };
  return new VPCPlugin(serverless, null);
};

const initMessage = "[Info] Updating VPC config...";
const initFuncMessage = `[Info] Getting VPC config for the function: '${testFuncName}'\n`;
const foundFuncMessage = `[Info] Found VPC with id '${vpcId}'`;

describe("serverless-vpc-plugin", () => {
  it("check aws config", () => {
    const plugin = constructPlugin({
      vpcName: vpc,
      subnets: subnets,
      securityGroups: securityGroups
    });
    plugin.initResources();

    expect(plugin.awsCredentials.accessKeyId).to.equal(testCreds.accessKeyId);
    expect(plugin.awsCredentials.sessionToken).to.equal(testCreds.sessionToken);
  });

  it("registers hooks", () => {
    const plugin = constructPlugin({});
    expect(plugin.hooks["before:package:initialize"]).to.be.a("function");
  });
});

describe("Given a vpc,", () => {
  it("function updates vpc", async () => {
    AWSMock.mock("EC2", "describeVpcs", testData);
    AWSMock.mock("EC2", "describeSubnets", testData);
    AWSMock.mock("EC2", "describeSecurityGroups", testData);

    const plugin = constructPlugin({
      vpcName: vpc,
      subnets: subnets,
      securityGroups: securityGroups
    });
    plugin.validateCustomVPCDiscoveryConfig();
    plugin.initResources();

    const expectedResult = {
      funcTest: {
        vpc: {
          securityGroupIds: ["sg-test"],
          subnetIds: ["subnet-test-1", "subnet-test-2", "subnet-test-3"]
        }
      }
    };
    return await plugin.updateFunctionsVpcConfig().then((data) => {
      expect(data).to.eql(expectedResult);
    });
  });

  it("vpc option given does not exist", async () => {
    AWSMock.mock("EC2", "describeVpcs", emptyData);

    const plugin = constructPlugin({});
    plugin.initResources();

    const funcVPCDiscovery: FuncVPCDiscovery = {
      vpcName: "test",
      subnets: [{ tagKey: "Name", tagValues: ["test_subnet"] }]
    };

    return await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then(() => {
      const expectedMessage = `VPC with tag key 'Name' and tag value '${funcVPCDiscovery.vpcName}' does not exist`;
      expect(consoleOutput[0]).to.equal(initFuncMessage.replace(testFuncName, "test"));
      expect(consoleOutput[1]).to.contain(expectedMessage);
    });
  });

  afterEach(() => {
    AWSMock.restore();
    consoleOutput = [];
  });
});

describe("Given valid inputs for Subnets and Security Groups ", () => {
  let plugin;
  beforeEach(() => {
    AWSMock.mock("EC2", "describeVpcs", testData);
    AWSMock.mock("EC2", "describeSecurityGroups", testData);
    AWSMock.mock("EC2", "describeSubnets", testData);

    plugin = constructPlugin({});
    plugin.initResources();
  });

  it("without wildcards", async () => {
    const funcVPCDiscovery: FuncVPCDiscovery = {
      vpcName: "test",
      subnets: subnets,
      securityGroups: securityGroups
    };

    await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then((vpc) => {
      expect(vpc.subnetIds).to.have.members(["subnet-test-1", "subnet-test-2", "subnet-test-3"]);
      expect(vpc.securityGroupIds).to.have.members(["sg-test"]);
    });
  });

  it("with wildcards", async () => {
    const funcVPCDiscovery: FuncVPCDiscovery = {
      vpcName: "test",
      subnets: [{ tagKey: "Name", tagValues: ["test_subnet_*"] }],
      securityGroups: [{ names: ["test_group_*"] }]
    };

    await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then((vpc) => {
      expect(vpc.subnetIds).to.have.members(["subnet-test-1", "subnet-test-2", "subnet-test-3"]);
      expect(vpc.securityGroupIds).to.have.members(["sg-test"]);
    });
  });

  afterEach(() => {
    AWSMock.restore();
    consoleOutput = [];
  });
});

describe("Given invalid input for ", () => {
  let plugin;
  beforeEach(() => {
    plugin = constructPlugin({});

    AWSMock.mock("EC2", "describeVpcs", testData);
  });

  const funcVPCDiscovery: FuncVPCDiscovery = {
    vpcName: "test",
    subnets: [{ tagKey: "Name", tagValues: ["test_subnet_1"] }],
    securityGroups: [{ names: ["test_group_1"] }]
  };

  it("Subnets", async () => {
    AWSMock.mock("EC2", "describeSecurityGroups", testData);
    AWSMock.mock("EC2", "describeSubnets", emptyData);

    plugin.initResources();

    await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then(() => {
      const expectedMessage = `Subnets with vpc id '${vpcId}', tag key 'Name' and tag values '${funcVPCDiscovery.subnets[0].tagValues}' do not exist`;
      expect(consoleOutput[0]).to.equal(initFuncMessage.replace(testFuncName, "test"));
      expect(consoleOutput[1]).to.equal(foundFuncMessage);
      expect(consoleOutput[2]).to.contain(expectedMessage);
    });
  });

  it("Security Groups", async () => {
    AWSMock.mock("EC2", "describeSecurityGroups", emptyData);
    AWSMock.mock("EC2", "describeSubnets", testData);

    plugin.initResources();

    await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then(() => {
      const expectedMessage = `Security groups with vpc id '${vpcId}', names '${securityGroups[0].names[0]}' do not exist`;
      expect(consoleOutput[0]).to.equal(initFuncMessage.replace(testFuncName, "test"));
      expect(consoleOutput[1]).to.equal(foundFuncMessage);
      expect(consoleOutput[2]).to.contain(expectedMessage);
    });
  });

  afterEach(() => {
    AWSMock.restore();
    consoleOutput = [];
  });
});

describe("Given input missing in AWS for ", () => {
  let plugin;
  beforeEach(() => {
    AWSMock.mock("EC2", "describeVpcs", testData);
    AWSMock.mock("EC2", "describeSubnets", testData);
    AWSMock.mock("EC2", "describeSecurityGroups", testData);

    plugin = constructPlugin({});
    plugin.initResources();
  });

  it("Subnets", async () => {
    const funcVPCDiscovery: FuncVPCDiscovery = {
      vpcName: "test",
      subnets: [{ tagKey: "Name", tagValues: ["test_subnet_*", "missing_subnet"] }],
      securityGroups: [{ names: ["test_group_*"] }]
    };
    plugin.initResources();

    await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then(() => {
      const expectedMessage = `Subnets with vpc id '${vpcId}', tag key 'Name' and tag values 'missing_subnet' do not exist.`;
      expect(consoleOutput[0]).to.equal(initFuncMessage.replace(testFuncName, "test"));
      expect(consoleOutput[1]).to.equal(foundFuncMessage);
      expect(consoleOutput[2]).to.contain(expectedMessage);
    });
  });

  it("Security Groups", async () => {
    const funcVPCDiscovery: FuncVPCDiscovery = {
      vpcName: "test",
      subnets: [{ tagKey: "Name", tagValues: ["test_subnet_*"] }],
      securityGroups: [{ names: ["test_group_*", "missing_security_group"] }]
    };

    await plugin.lambdaFunction.getFuncVPC("test", funcVPCDiscovery).then(() => {
      const expectedMessage = "Security groups do not exist for the names";
      expect(consoleOutput[0]).to.equal(initFuncMessage.replace(testFuncName, "test"));
      expect(consoleOutput[1]).to.equal(foundFuncMessage);
      expect(consoleOutput[2]).to.contain(expectedMessage);
    });
  });

  afterEach(() => {
    AWSMock.restore();
    consoleOutput = [];
  });
});

describe("Catching errors in updateVpcConfig ", () => {
  it("AWS api call describeVpcs fails", async () => {
    AWSMock.mock("EC2", "describeVpcs", emptyData);

    const plugin = constructPlugin({
      vpcName: vpc,
      subnets: subnets,
      securityGroups: securityGroups
    });
    plugin.validateCustomVPCDiscoveryConfig();
    plugin.initResources();

    await plugin.updateFunctionsVpcConfig().then(() => {
      const expectedErrorMessage = `VPC with tag key 'Name' and tag value '${vpc}' does not exist.`;
      expect(consoleOutput[0]).to.equal(initMessage);
      expect(consoleOutput[1]).to.equal(initFuncMessage);
      expect(consoleOutput[2]).to.contain(expectedErrorMessage);
    });
  });

  it("Serverless file is configured incorrectly", () => {
    const plugin = constructPlugin({
      securityGroupNames: securityGroups
    });

    try {
      plugin.validateCustomVPCDiscoveryConfig();
    } catch (err) {
      const expectedErrorMessage = "The `custom.vpcDiscovery` is not configured correctly: \n" +
        "Error: 'vpcDiscovery.vpcName' is not specified.  Please see README for proper setup.";
      expect(err.message).to.equal(expectedErrorMessage);
      return true;
    }
  });

  afterEach(() => {
    AWSMock.restore();
    consoleOutput = [];
  });
});
