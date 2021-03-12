pragma solidity ^0.5.0;
import { Semaphore } from "./Semaphore.sol";

/*
 * A library to contain the semaphore contract source to avoid contract size limitation
 */
library SemaphoreLibrary {

    function newSemaphore(
        uint8 _tree_levels,
        uint256 _zero_value,
        uint256 _first_external_nullifier
    ) public returns (Semaphore){
            return new Semaphore(_tree_levels, _zero_value, _first_external_nullifier);
    }

}
