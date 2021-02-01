pragma solidity ^0.5.0;
import { Mixer } from "./Mixer.sol";
import { IERC20 } from "./token/IERC20.sol";

/*
 * A mixer registry to deploy mixer for either ETH or ERC20 tokens.
 * See https://hackmd.io/qlKORn5MSOes1WtsEznu_g for the full specification.
 */
contract MixerRegistry {
    
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
    
    address public semaphore;
    
    /*
     * Constructor
     * @param _semaphore The address of the Semaphore contract which should
     * have been deployed earlier
     */
    constructor (address _semaphore) public {
        require(_semaphore != address(0), "Mixer: invalid Semaphore address");
        // Set the Semaphore contract
        semaphore = _semaphore;
    }
    
    function newMixer(uint256 _mixAmt, address _token) public {
        if (!mixerR[_token].initialized){
            tokenArray.push(_token);
            tokenArraySize++;
            mixerR[_token].initialized = true;
            mixerR[_token].token = IERC20(_token);
        }else{
            require(!mixerR[_token].mixer[_mixAmt].initialized, "Mixer already registered");
        }
        mixerR[_token].mixer[_mixAmt].mixer = new Mixer(semaphore, _mixAmt, _token);
        mixerR[_token].mixer[_mixAmt].initialized = true;
        mixerR[_token].mixerArray.push(_mixAmt);
        mixerR[_token].mixerArraySize++;
    }
    
    function getTokenMixerList(address _token) public view returns(uint256[] memory) {
        return mixerR[_token].mixerArray;
    }
    
    function getTokenMixerAddress(uint256 _mixAmt, address _token) public view returns(Mixer) {
        return mixerR[_token].mixer[_mixAmt].mixer;
    }
    
}
