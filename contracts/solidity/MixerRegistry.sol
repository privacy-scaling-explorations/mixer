pragma solidity ^0.5.0;
import { SemaphoreLibrary } from "./SemaphoreLibrary.sol";
import { Semaphore } from "./Semaphore.sol";
import { Mixer } from "./Mixer.sol";
import { IERC20 } from "./token/IERC20.sol";

/*
 * A mixer registry to deploy mixer for either ETH or ERC20 tokens.
 * See https://hackmd.io/qlKORn5MSOes1WtsEznu_g for the full specification.
 */
contract MixerRegistry {

    using SemaphoreLibrary for uint8;

    struct MixerS {
        Mixer mixer;
        bool initialized;
    }

    struct TokenS {
        IERC20 token;
        mapping(uint256 => MixerS) mixer;
        uint256[] mixerArray;
        uint mixerArraySize;
        bool initialized;
    }

    mapping(address => TokenS) public mixerR;
    address[] public tokenArray;
    uint public tokenArraySize;

    uint8 public tree_levels;
    uint256 public zero_value;
    uint256 public first_external_nullifier;


    /*
     * Constructor
     * @param _semaphore The address of the Semaphore contract which should
     * have been deployed earlier
     */
    constructor (uint8 _tree_levels, uint256 _zero_value, uint256 _first_external_nullifier) public {
        tree_levels = _tree_levels;
        zero_value = _zero_value;
        first_external_nullifier = _first_external_nullifier;
    }

    function newMixer(uint256 _mixAmt, address _token) public returns(Mixer){
        if (!mixerR[_token].initialized){
            tokenArray.push(_token);
            tokenArraySize++;
            mixerR[_token].initialized = true;
            mixerR[_token].token = IERC20(_token);
        }else{
            require(!mixerR[_token].mixer[_mixAmt].initialized, "Mixer already registered");
        }

        //Run new semaphore using the library
        Semaphore semaphore = tree_levels.newSemaphore(zero_value, first_external_nullifier);
        //Deploy the mixer
        Mixer mixer = new Mixer(address(semaphore), _mixAmt, _token);
        //Set Ownership of Semaphore contract
        semaphore.transferOwnership(address(mixer));
        //Set Semaphore external nullifier
        mixer.setSemaphoreExternalNulllifier();

        mixerR[_token].mixer[_mixAmt].mixer = mixer;
        mixerR[_token].mixer[_mixAmt].initialized = true;
        mixerR[_token].mixerArray.push(_mixAmt);
        mixerR[_token].mixerArraySize++;
        return mixer;
    }

    function getTokenMixerList(address _token) public view returns(uint256[] memory) {
        return mixerR[_token].mixerArray;
    }

    function getTokenMixerAddress(uint256 _mixAmt, address _token) public view returns(Mixer) {
        return mixerR[_token].mixer[_mixAmt].mixer;
    }

}
