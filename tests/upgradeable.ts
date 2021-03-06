const { ZERO_ADDRESS, ROLE, Data } = require('./helpers/common');
import "@nomiclabs/hardhat-ethers";
import { ethers, upgrades} from "hardhat";
 
import chai from "chai";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
const { expect } = chai;

// make sure to have ethers.js 5.X required, else this will fail!
const BigNumber = ethers.BigNumber;
import { Zoom } from "../src/index";

const ZoomContractName = "Zoom2";
const TestContractName = "MappedStructsUpgradeable";

describe("Zoom MappedStructsUpgradeable", function () {

    // web3 library instance that uses Zoom Http Provider
    let ZoomLibraryInstance: any, accounts: any; 
    let MappedStructs: any, ZoomContract: any;
    let origData:any = {};

    before(async () => {
        accounts = await ethers.getSigners();
        // Once everything is loaded instantiate the Zoom Library
        ZoomLibraryInstance = new Zoom({
            clone_cache: false,
            use_reference_calls: false
        });

        // deploy targets
        console.log("============= Targets ===============" );

        // const ListContractArtifacts = await ethers.getContractFactory("ListContract");
        // const ListContract = await ListContractArtifacts.deploy();
        // await ListContract.deployed();
        // console.log("    ListContract:            ", ListContract.address);

        const MappedStructsArtifacts = await ethers.getContractFactory(TestContractName);
        MappedStructs = await upgrades.deployProxy(MappedStructsArtifacts);
        // MappedStructs = await MappedStructsArtifacts.deploy();

        await MappedStructs.deployed();
        console.log("    MappedStructsName:      ", TestContractName);
        console.log("    MappedStructs:          ", MappedStructs.address);

        //initialize
        // let tx = await MappedStructs.initialize();
        // await tx.wait();


        const ZoomContractArtifacts = await ethers.getContractFactory(ZoomContractName);
        ZoomContract = await ZoomContractArtifacts.deploy();
        await ZoomContract.deployed();
        console.log("    ZoomContractName:       ", ZoomContractName);
        console.log("    ZoomContract:           ", ZoomContract.address);

        
        // load original data from contract

        const itemCount = await MappedStructs.itemCount();
        const items = [];        
        
        origData.itemCount = itemCount.toNumber();

        for(let i = itemCount; i > 0; i--) {
            const item = await MappedStructs.itemMap(i);
            items.push(item.toString());
        }
        origData.items = items;
        // console.log("origData", origData);
       
    });





    it("data returned by zoom matches data in original contract", async function () {

        
        console.log("========== ZOOM SETUP ===============" );

    

        const item_identifiers = [];
        const expectedResultCount = 10;
    

        const itemCount_identifier = ZoomLibraryInstance.addMappingCountCall(
            // the contract we're calling
            MappedStructs, 
            // the method that is returing our ID
            [ "itemCount", [] ],
            // signature used to decode the result
            "itemCount() returns (uint256)",
            // array of next method calls that will use the result of this current call
            [
                { contract: MappedStructs, mapAndParams: ["itemMap", [0]] },
            ]
        );

        for(let i = 0; i < expectedResultCount; i++) {
            item_identifiers.push( ZoomLibraryInstance.addType4Call(
                MappedStructs, 
                ["itemMap", [i]],
                "itemMap(uint256) returns (string, address, uint256, uint16, bool)" 
                ) 
            );
        }
    
        const ZoomQueryBinary = ZoomLibraryInstance.getZoomCall();
    
        console.log("======== ZOOM CALL START ============" );
        console.time('zoomCall')
        const combinedResult = await ZoomContract.combine( ZoomQueryBinary );
        console.timeEnd('zoomCall')
    
        console.log("======== ZOOM CALL END ==============" );
        ZoomLibraryInstance.resultsToCache( combinedResult, ZoomQueryBinary );
        console.log("======== ZOOM RESULTS ===============" );

        const zoomData:any = {};
        const itemCount = parseInt( ZoomLibraryInstance.decodeCall(itemCount_identifier.toString()).toString() ) ;
        console.log("itemCount:", itemCount);
        zoomData.itemCount = itemCount;

        const items = [];
        for(let i = 0; i < expectedResultCount; i++) {
            const item = ZoomLibraryInstance.decodeCall(item_identifiers[i].toString()).toString();
            // console.log("itemMap_"+i+": ", item);
            items.push(item.toString());
        }

        zoomData.items = items;

        console.log("======== ZOOM RESULTS END ===========" );


        // validate
        console.log("origData", origData);
        console.log("zoomData", zoomData);
        
        let ok:number, error: number;
        [ok, error] = validate(origData, zoomData)
        expect(error).to.be.equal(0);
        
    });

});


function validate(set1: any, set2: any) {
    let ok = 0;
    let error = 0;
    for(let i = 0; i < set1.itemCount; i++) {
        let origItem = set1.items[i];
        let newItem = set2.items[i];
        if(origItem == newItem) {
            ok++;
        } else {
            error++;
        }
    }

    return [
        ok,
        error,
    ];
}