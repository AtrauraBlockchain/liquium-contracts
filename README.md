# Liquium Contracts

Liquium is an Open Source polling framework based in Smart Contracts running in the Ethereum network which allows to perform liquid democracy.

We've built a template for organizations which want to integrate a public, fair and transparent polling system, so they can modify it for their own context just forking this and its brother repositories.

You can know more about Liquium in our [wiki](https://github.com/AtrauraBlockchain/liquium-contracts/wiki/About-Liquium).

# Liquium Smart Contracts

This smart contacts define the data structures and the functionalities of the Liquium polling system.

In this contracts are represented:
- Organizations
- Categories
- Polls
- Voters
- Delegates

# Install and test

#### Clone this repository.

    git clone https://github.com/AtrauraBlockchain/liquium-contracts.git
    cd liquium-contracts

#### Start an ethereum client.

    npm install -g
    testrpc

#### Install

    npm install

#### Deploy an organization

    node
    > .load env_test.js
    > deployOrganization()

#### Add a category

    > addCategory("Education");

#### Add a voter

    > addVoter(web3.eth.accounts[1], "Voter1");

Note that voters and delegates will receive some Eth for gas.

#### Add a delegate

    > addDelegate(web3.eth.accounts[2], "Delegate1");

#### Create a poll

    > var poll1 = {
            question: "Question 1",
            options: [
                "Option1",
                "Option2",
                "Option3"
            ],
            closeDelegateTime: Math.floor(new Date().getTime()/1000) + 86400*7,
            closeTime: Math.floor(new Date().getTime()/1000) + 86400*14,
            idCategory: 1
        };
    > addPoll("Poll1", poll1);

#### vote

    > vote(eth.accounts[2], 1, 0)

First param is the voter/delegate address
Second param is the poll
Therd param is the option to voto (relative to zero)

#### Print Info

To Display the full state of an organization

    > getInfo()

If we want to add to this JSON info specific to a voter/delegate

    > getInfo(eth.account[1])


# Tests

    npm install -g mocha
    npm run test

![banner](https://s30.postimg.org/rd8670hi9/Pasted_image_at_2017_01_03_04_52_PM_1.png)
