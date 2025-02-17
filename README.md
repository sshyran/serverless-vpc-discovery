# serverless-vpc-discovery
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/amplify-education/serverless-vpc-discovery.svg?branch=master)](https://travis-ci.org/amplify-education/serverless-vpc-discovery)
[![npm version](https://badge.fury.io/js/serverless-vpc-discovery.svg)](https://badge.fury.io/js/serverless-vpc-discovery)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/amplify-education/serverless-vpc-discovery/master/LICENSE)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/c3ba87d04fe24b8f881252705e51cc29)](https://www.codacy.com/app/CFER/serverless-vpc-discovery?utm_source=github.com&utm_medium=referral&utm_content=amplify-education/serverless-vpc-discovery&utm_campaign=badger)
[![npm downloads](https://img.shields.io/npm/dt/serverless-vpc-discovery.svg?style=flat)](https://www.npmjs.com/package/serverless-vpc-discovery)

The vpc discovery plugin takes the given vpc name, subnet tag key/value, and security group tag key/value or names in the serverless file to setup the vpc configuration for the lambda.

Basically we use this config:
```
vpcDiscovery:
    vpcName: '<vpc_name>'
    subnets:
      - tagKey: <tag_name>
        tagValues:
          - '<tag_vale>'
    securityGroups:
      - tagKey: <tag_name>
        tagValues:
          - '<tag_value>'
```
To generate this config:
```
vpc:
    subnetIds:
        - subnet-123456789
        ...
    securityGroupIds:
        - sg-123456789
        ...
```
For each lambda function.
      
> Note: The core serverless `provider.vpc` settings will be used, if they are set, instead of `vpcDiscovery`. You can use also mix settings. For example you may set `provider.vpc.subnetIds` while using `vpcDiscovery` to set the `securityGroupIds`. Take a look at [official documentation](https://www.serverless.com/framework/docs/providers/aws/guide/functions#vpc-configuration). 

# About Amplify
Amplify builds innovative and compelling digital educational products that empower teachers and students across the country. We have a long history as the leading innovator in K-12 education - and have been described as the best tech company in education and the best education company in tech. While others try to shrink the learning experience into the technology, we use technology to expand what is possible in real classrooms with real students and teachers.

Learn more at https://www.amplify.com

# Getting Started

## Prerequisites
Make sure you have the following installed before starting:
* [nodejs](https://nodejs.org/en/download/)
* [npm](https://www.npmjs.com/get-npm?utm_source=house&utm_medium=homepage&utm_campaign=free%20orgs&utm_term=Install%20npm)
* [serverless](https://serverless.com/framework/docs/providers/aws/guide/installation/)

Also allow the lambda to have the following IAM permissions:
* ec2:CreateNetworkInterface
* ec2:DescribeNetworkInterfaces
* ec2:DeleteNetworkInterface

## Installation
Run:
```
# From npm (recommended)
npm install serverless-vpc-discovery

# From github
npm install https://github.com/amplify-education/serverless-vpc-discovery.git
```
Then make the following edits to your serverless.yaml file:
```yaml
plugins:
  - serverless-vpc-discovery

# Optional: Either set `custom.vpcDiscovery` or `functions.<function name>.vpcDiscovery`
custom:
  vpcDiscovery:
    vpcName: '<vpc_name>'
    
    # optional if `securityGroups` option is specified
    # list of tag key and values 
    subnets:
      - tagKey: <tag_name>
        
        # an array of values
        tagValues:
          - '<tag_value>'

    # optional if `subnets` option is specified
    # list of tag key and value or names
    securityGroups:
      - tagKey: <tag_name>
        
        # an array of values
        tagValues:
          - '<tag_value>'
      
      # optional if `tagKey` and `tagValues` are specified
      # an array of values
      - names:
        - '<security_group_name>'

# Optional: Either set `custom.vpcDiscovery` or `functions.<function name>.vpcDiscovery`
functions:
  example:
    handler: handler.example
    # inherit `custom.vpcDiscovery` config in case `custom.vpcDiscovery` is specified
  
  example2:
    handler: handler.example
    
    # skip vpc configuration for the current function
    vpcDiscovery: false
    
  example3:
    handler: handler.example
    
    # inherit `custom.vpcDiscovery` config in case `custom.vpcDiscovery` is specified and override security group names
    vpcDiscovery:
      vpcName: '<vpc_name>'
      securityGroups:
        - tagKey: <tag_name>
          
          # an array of values
          tagValues:
            - '<tag_value>'
  
  example4:
    handler: handler.example
    # override or set basic subnets and security groups items
    vpcDiscovery:
      vpcName: '<vpc_name>'
      
      # optional if `custom.vpcDiscovery.securityGroups` option is specified
      subnets: 
        - tagKey: <tag_name>
          
          # an array of values
          tagValues:
            - '<tag_value>'

      # optional if `custom.vpcDiscovery.subnets` option is specified
      securityGroups: 
        
        # optional if `names` option is specified
        - tagKey: <tag_name>
          
          # an array of values
          tagValues:
            - '<tag_value>'
        
        # optional if `tagKey` and `tagValues` are specified
        # an array of values
        - names: 
          - '<security_group_name>'
```

## Running Tests
To run the test:
```
npm test
```
All tests should pass.

To run integration tests, set an environment variable TEST_VPC_NAME to the VPC you will be testing for. Then,
```
export AWS_PROFILE=your_profile
export TEST_VPC_NAME=vpc_name
npm build
npm run integration-test
```

If there is an error build and install the node_module inside the serverless-vpc-discovery folder:
```
npm build
npm install .
```

## Deploying with the plugin
When deploying run:
```
serverless deploy --env 'VPC Name'
```

And that should be it! Good Luck!

# How it Works

The vpc, subnets, and security groups are found by filtering based on a specified tag name.
Vpc and subnets are found under the tag name `tag:Name`.
Security groups are found by the name of the group under `group-name`.

The vpc is found first as it is used to find the subnets and security groups. Once all of the subnets and security groups are found the serverless service provider creates a vpc object and stores the subnets and security groups.

# Responsible Disclosure
If you have any security issue to report, contact project maintainers privately.
You can reach us at <github@amplify.com>

# Contributing
We welcome pull requests! For your pull request to be accepted smoothly, we suggest that you:
1. For any sizable change, first open a GitHub issue to discuss your idea.
2. Create a pull request.  Explain why you want to make the change and what it’s for.
We’ll try to answer any PR’s promptly.
